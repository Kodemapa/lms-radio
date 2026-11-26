import { Global, Logger, Module, type OnApplicationBootstrap } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import Redis from 'ioredis';
import { AppConfigService } from '../config/app-config.service';
import { CacheInterceptor } from './cache.interceptor';
import { CACHE_STORE, CacheService, GLOBAL_VERSION } from './cache.service';
import { type CacheStore, FallbackCacheStore, MemoryCacheStore, RedisCacheStore } from './cache.store';

function createStore(config: AppConfigService): CacheStore | null {
  if (!config.get('CACHE_ENABLED')) return null;
  const url = config.get('REDIS_URL');
  if (!url) {
    warnIfUnshared();
    return new MemoryCacheStore(config.get('CACHE_MEMORY_MAX_ENTRIES'));
  }
  const redis = new Redis(url, {
    // Fail fast instead of queueing: a cache that waits is worse than no cache.
    enableOfflineQueue: false,
    maxRetriesPerRequest: 1,
    connectTimeout: 2000,
    // A connected but stalled Redis (overloaded, failing over) must not hold requests up:
    // a command slower than this counts as a miss and the request goes to the database.
    commandTimeout: config.get('CACHE_REDIS_COMMAND_TIMEOUT_MS'),
    keyPrefix: config.get('CACHE_KEY_PREFIX'),
  });
  redis.on('error', (error: Error) => new Logger('Cache').debug(`Redis: ${error.message}`));
  const shared = new RedisCacheStore(redis);
  // Without a reachable Redis (e.g. local development) the in-memory cache is used instead.
  return new FallbackCacheStore(redis, shared, new MemoryCacheStore(config.get('CACHE_MEMORY_MAX_ENTRIES')), () => shared.bump(GLOBAL_VERSION));
}

/**
 * Several API processes (PM2 cluster mode sets NODE_APP_INSTANCE), each with its own
 * in-memory cache, do not see each other's invalidations: a change could show stale for up
 * to an endpoint's TTL on the other processes. Say so at startup.
 */
function warnIfUnshared(): void {
  if (process.env.NODE_APP_INSTANCE === undefined) return;
  new Logger('Cache').warn(
    'Several API processes and no REDIS_URL: each keeps its own cache and invalidations are not shared. Set REDIS_URL or run one process.',
  );
}

/**
 * Response cache (Redis when REDIS_URL is set, in-process otherwise). See CacheService for
 * the keying and invalidation rules, and `@Cached` for which endpoints use it.
 */
@Global()
@Module({
  providers: [
    { provide: CACHE_STORE, inject: [AppConfigService], useFactory: createStore },
    CacheService,
    { provide: APP_INTERCEPTOR, useClass: CacheInterceptor },
  ],
  exports: [CacheService],
})
export class CacheModule implements OnApplicationBootstrap {
  constructor(private readonly cache: CacheService) {}

  onApplicationBootstrap(): void {
    this.cache.logBackend();
  }
}
