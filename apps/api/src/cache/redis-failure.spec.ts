import { createServer, type Server, type Socket } from 'node:net';
import Redis, { type RedisOptions } from 'ioredis';
import { CacheService } from './cache.service';
import { FallbackCacheStore, MemoryCacheStore, RedisCacheStore } from './cache.store';

/**
 * Redis failure modes over real sockets (no Redis needed): the cache must give up fast and
 * report a miss, so a request falls through to the database instead of waiting on Redis.
 */
describe('Redis failure behaviour', () => {
  let blackHole: Server;
  let port: number;
  const sockets = new Set<Socket>();
  const clients: Redis[] = [];

  beforeAll(async () => {
    // Accepts connections and never answers: a stalled / overloaded Redis.
    blackHole = createServer((socket) => {
      sockets.add(socket);
      socket.on('error', () => undefined);
    });
    await new Promise<void>((resolve) => blackHole.listen(0, '127.0.0.1', resolve));
    port = (blackHole.address() as { port: number }).port;
  });

  afterAll(async () => {
    for (const client of clients) client.disconnect();
    for (const socket of sockets) socket.destroy();
    await new Promise((resolve) => blackHole.close(resolve));
  });

  function client(options: RedisOptions): Redis {
    const redis = new Redis({ enableOfflineQueue: false, maxRetriesPerRequest: 1, connectTimeout: 300, lazyConnect: false, ...options });
    redis.on('error', () => undefined);
    clients.push(redis);
    return redis;
  }

  it('a stalled Redis (connected, no answers) times out commands and serves a miss quickly', async () => {
    const redis = client({ host: '127.0.0.1', port, enableReadyCheck: false, commandTimeout: 200 });
    await new Promise<void>((resolve) => redis.once('ready', () => resolve()));
    const cache = new CacheService(new RedisCacheStore(redis));

    const started = Date.now();
    const key = await cache.keyFor('user', '/users/me', '11111111-1111-4111-8111-111111111111', 'LEARNER');
    expect(key).toBeNull(); // versions unreadable → not cacheable → handler runs
    await expect(cache.afterWrite({ userId: 'u', role: 'ADMIN' })).resolves.toBeUndefined();
    expect(Date.now() - started).toBeLessThan(1500);
  });

  it('an unreachable Redis falls back to the in-memory cache without delaying requests', async () => {
    const redis = client({ host: '127.0.0.1', port: 1, commandTimeout: 200, retryStrategy: () => 1000 });
    const store = new FallbackCacheStore(redis, new RedisCacheStore(redis), new MemoryCacheStore(), async () => undefined);
    const cache = new CacheService(store);

    const started = Date.now();
    const key = (await cache.keyFor('public', '/courses'))!;
    await cache.set(key, { courses: 1 }, 60);
    expect(await cache.get(key)).toEqual({ courses: 1 });
    expect(store.kind).toBe('memory');
    expect(Date.now() - started).toBeLessThan(100);
  });
});
