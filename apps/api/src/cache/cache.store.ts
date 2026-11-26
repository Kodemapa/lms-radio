import { Logger } from '@nestjs/common';
import type Redis from 'ioredis';

/**
 * Where cached responses live. Values are JSON strings, so a cached body is exactly what
 * Express would have sent and no caller can mutate a shared object.
 */
export interface CacheStore {
  readonly kind: 'redis' | 'memory';
  get(key: string): Promise<string | undefined>;
  set(key: string, value: string, ttlSeconds: number): Promise<void>;
  /** Current values of version counters (0 when never bumped). */
  versions(keys: string[]): Promise<number[]>;
  bump(key: string): Promise<void>;
  close(): Promise<void>;
}

/**
 * Per-process store for development and single-instance deployments. Oldest entries are
 * evicted past `maxEntries`, and expired ones on read.
 */
export class MemoryCacheStore implements CacheStore {
  readonly kind = 'memory' as const;
  private readonly entries = new Map<string, { value: string; expiresAt: number }>();
  private readonly counters = new Map<string, number>();

  constructor(
    private readonly maxEntries = 5000,
    private readonly now: () => number = Date.now,
  ) {}

  async get(key: string): Promise<string | undefined> {
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt <= this.now()) {
      this.entries.delete(key);
      return undefined;
    }
    return entry.value;
  }

  async set(key: string, value: string, ttlSeconds: number): Promise<void> {
    this.entries.delete(key);
    this.entries.set(key, { value, expiresAt: this.now() + ttlSeconds * 1000 });
    while (this.entries.size > this.maxEntries) {
      const oldest = this.entries.keys().next().value as string;
      this.entries.delete(oldest);
    }
  }

  async versions(keys: string[]): Promise<number[]> {
    return keys.map((key) => this.counters.get(key) ?? 0);
  }

  async bump(key: string): Promise<void> {
    this.counters.set(key, (this.counters.get(key) ?? 0) + 1);
  }

  async close(): Promise<void> {
    this.entries.clear();
  }

  /** For tests and diagnostics. */
  get size(): number {
    return this.entries.size;
  }
}

/**
 * Shared store for multi-instance deployments. Every call is best-effort: if Redis is
 * down the request is served from the database (a miss), never failed.
 */
export class RedisCacheStore implements CacheStore {
  readonly kind = 'redis' as const;
  private readonly logger = new Logger('Cache');
  private lastWarning = 0;

  constructor(private readonly redis: Redis) {}

  async get(key: string): Promise<string | undefined> {
    try {
      return (await this.redis.get(key)) ?? undefined;
    } catch (error) {
      this.warn(error);
      return undefined;
    }
  }

  async set(key: string, value: string, ttlSeconds: number): Promise<void> {
    try {
      await this.redis.set(key, value, 'EX', ttlSeconds);
    } catch (error) {
      this.warn(error);
    }
  }

  async versions(keys: string[]): Promise<number[]> {
    try {
      const values = await this.redis.mget(...keys);
      return values.map((value) => Number(value ?? 0) || 0);
    } catch (error) {
      this.warn(error);
      // Unknown versions: return a value no entry was written under, i.e. always miss.
      return keys.map(() => -1);
    }
  }

  async bump(key: string): Promise<void> {
    try {
      await this.redis.incr(key);
    } catch (error) {
      this.warn(error);
    }
  }

  async close(): Promise<void> {
    await this.redis.quit().catch(() => undefined);
  }

  /** At most one warning a minute, so an outage does not flood the logs. */
  private warn(error: unknown): void {
    const now = Date.now();
    if (now - this.lastWarning < 60_000) return;
    this.lastWarning = now;
    this.logger.warn(`Redis cache unavailable, serving uncached: ${String((error as Error)?.message ?? error)}`);
  }
}

/**
 * Redis when it is reachable, the in-process store while it is not, so a missing or
 * restarting Redis (e.g. a developer machine without one) still gets a working cache.
 *
 * Consistency across switches:
 *  - When Redis becomes ready, the memory store is emptied: entries cached during an
 *    outage are never served in a later outage, after invalidations went to Redis.
 *  - When Redis comes back after an outage, `onRecovered` runs (CacheModule bumps the
 *    global version), because invalidations during the outage only reached memory.
 */
export class FallbackCacheStore implements CacheStore {
  private readonly logger = new Logger('Cache');
  private everReady = false;
  private lostAfterReady = false;

  constructor(
    private readonly redis: Redis,
    private readonly primary: CacheStore,
    private readonly fallback: MemoryCacheStore,
    onRecovered: () => Promise<void>,
  ) {
    redis.on('ready', () => {
      void this.fallback.close();
      if (this.lostAfterReady) {
        this.logger.log('Redis is back: shared cache resumed (all entries invalidated)');
        void onRecovered();
      } else if (!this.everReady) {
        this.logger.log('Redis connected: shared cache in use');
      }
      this.everReady = true;
      this.lostAfterReady = false;
    });
    redis.on('end', () => this.markLost());
    redis.on('close', () => this.markLost());
  }

  get kind(): 'redis' | 'memory' {
    return this.redis.status === 'ready' ? 'redis' : 'memory';
  }

  private get active(): CacheStore {
    return this.redis.status === 'ready' ? this.primary : this.fallback;
  }

  private markLost(): void {
    if (this.everReady && !this.lostAfterReady) {
      this.lostAfterReady = true;
      this.logger.warn('Redis connection lost: using the in-memory cache until it returns');
    }
  }

  get(key: string): Promise<string | undefined> {
    return this.active.get(key);
  }
  set(key: string, value: string, ttlSeconds: number): Promise<void> {
    return this.active.set(key, value, ttlSeconds);
  }
  versions(keys: string[]): Promise<number[]> {
    return this.active.versions(keys);
  }
  bump(key: string): Promise<void> {
    return this.active.bump(key);
  }
  async close(): Promise<void> {
    await Promise.all([this.primary.close(), this.fallback.close()]);
  }
}
