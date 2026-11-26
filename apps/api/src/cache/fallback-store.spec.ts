import { EventEmitter } from 'node:events';
import type Redis from 'ioredis';
import { FallbackCacheStore, MemoryCacheStore } from './cache.store';

/** Stands in for ioredis: a status and connection events. */
class FakeRedis extends EventEmitter {
  status = 'connecting';
  setStatus(status: string, event?: string) {
    this.status = status;
    if (event) this.emit(event);
  }
}

describe('FallbackCacheStore', () => {
  function setup() {
    const redis = new FakeRedis();
    const shared = new MemoryCacheStore(); // plays the Redis-backed store
    const local = new MemoryCacheStore();
    const recovered = jest.fn(async () => shared.bump('cache:ver:global'));
    const store = new FallbackCacheStore(redis as unknown as Redis, shared, local, recovered);
    return { redis, shared, local, store, recovered };
  }

  it('uses the in-memory store while Redis is unreachable (no Redis locally)', async () => {
    const { store, local, shared } = setup();
    expect(store.kind).toBe('memory');
    await store.set('k', '"v"', 60);
    expect(await local.get('k')).toBe('"v"');
    expect(await shared.get('k')).toBeUndefined();
  });

  it('switches to Redis once it is ready, emptying the memory store', async () => {
    const { store, redis, local, shared } = setup();
    await store.set('k', '"from-outage"', 60);
    redis.setStatus('ready', 'ready');
    expect(store.kind).toBe('redis');
    expect(local.size).toBe(0);
    await store.set('k2', '"shared"', 60);
    expect(await shared.get('k2')).toBe('"shared"');
  });

  it('invalidates everything in Redis when it comes back after an outage', async () => {
    const { store, redis, recovered, shared } = setup();
    redis.setStatus('ready', 'ready');
    expect(recovered).not.toHaveBeenCalled(); // first connection: nothing missed
    redis.setStatus('reconnecting', 'close');
    expect(store.kind).toBe('memory');
    await store.bump('cache:ver:user:u1'); // an invalidation during the outage only reaches memory
    redis.setStatus('ready', 'ready');
    expect(recovered).toHaveBeenCalledTimes(1);
    expect(await shared.versions(['cache:ver:global'])).toEqual([1]);
  });
});
