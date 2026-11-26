import { createHash } from 'node:crypto';
import { Inject, Injectable, Logger, type OnApplicationShutdown } from '@nestjs/common';
import { type Role } from '@obgyn/types';
import { type CacheStore } from './cache.store';

export const CACHE_STORE = Symbol('CACHE_STORE');

/**
 * `user`: the response depends on who asks; it is stored under that user's ID and only
 * ever returned to the same user. `public`: the same for every visitor.
 */
export type CacheScope = 'user' | 'public';

export const GLOBAL_VERSION = 'cache:ver:global';
const userVersionKey = (userId: string) => `cache:ver:user:${userId}`;

/** Roles whose writes can change what other people see (catalogue, grades, settings). */
const STAFF_ROLES: ReadonlySet<Role> = new Set<Role>(['ADMIN', 'FACULTY']);

/**
 * Response cache with version-based invalidation.
 *
 * Keys embed a global version and, for `user` scope, the user's ID, role and personal version:
 *   cache:resp:user:<userId>:<role>:g<global>:u<userVersion>:<sha256(url)>
 * Bumping a version makes every older entry unreachable at once (they then expire on
 * their short TTL), so no key scans are needed:
 *  - a user's own write bumps their personal version: they see their change immediately;
 *  - a staff write (admin/faculty) bumps the global version: everyone sees it;
 *  - a notification for a user bumps that user's version.
 * One user's entries can never be read by another: the user ID is part of the key. The role
 * is too, so after a role change nothing cached under the old role is served (role changes
 * also revoke sessions and, as a staff write, bump the global version; this is a backstop).
 */
@Injectable()
export class CacheService implements OnApplicationShutdown {
  private readonly logger = new Logger('Cache');

  constructor(@Inject(CACHE_STORE) private readonly store: CacheStore | null) {}

  get enabled(): boolean {
    return this.store !== null;
  }

  get backend(): 'redis' | 'memory' | 'disabled' {
    return this.store?.kind ?? 'disabled';
  }

  /**
   * The key for this request, or null when it must not be cached (cache off, a user-scope
   * request without a user, or Redis versions unreadable).
   */
  async keyFor(scope: CacheScope, url: string, userId?: string, role?: string): Promise<string | null> {
    if (!this.store) return null;
    if (scope === 'user' && !userId) return null;
    const versionKeys = scope === 'user' ? [GLOBAL_VERSION, userVersionKey(userId!)] : [GLOBAL_VERSION];
    const [global, personal] = await this.store.versions(versionKeys);
    if (global! < 0 || (personal ?? 0) < 0) return null;
    const hash = createHash('sha256').update(url).digest('base64url');
    return scope === 'user'
      ? `cache:resp:user:${userId}:${role ?? '-'}:g${global}:u${personal}:${hash}`
      : `cache:resp:public:g${global}:${hash}`;
  }

  async get<T = unknown>(key: string): Promise<T | undefined> {
    const raw = await this.store?.get(key);
    if (raw === undefined) return undefined;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return undefined;
    }
  }

  async set(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    // `undefined` has no JSON form; a handler returning nothing is not worth caching.
    if (!this.store || value === undefined) return;
    await this.store.set(key, JSON.stringify(value), ttlSeconds);
  }

  /** Called after any write request: forget what this user (or, for staff, everyone) saw. */
  async afterWrite(actor: { userId: string; role: Role } | undefined): Promise<void> {
    if (!this.store || !actor) return;
    await Promise.all([
      this.store.bump(userVersionKey(actor.userId)),
      STAFF_ROLES.has(actor.role) ? this.store.bump(GLOBAL_VERSION) : Promise.resolve(),
    ]);
  }

  /** Something changed for these users that they did not do themselves (e.g. a notification). */
  async invalidateUsers(userIds: Iterable<string>): Promise<void> {
    if (!this.store) return;
    await Promise.all([...new Set(userIds)].map((id) => this.store!.bump(userVersionKey(id))));
  }

  /** Everyone's cached responses are stale (e.g. a background job changed shared data). */
  async invalidateAll(): Promise<void> {
    await this.store?.bump(GLOBAL_VERSION);
  }

  async onApplicationShutdown(): Promise<void> {
    await this.store?.close();
  }

  logBackend(): void {
    this.logger.log(`Response cache backend: ${this.backend}`);
  }
}
