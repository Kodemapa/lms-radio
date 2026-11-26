import { SetMetadata } from '@nestjs/common';
import { type CacheScope } from './cache.service';

export const CACHED_METADATA = 'obgyn:cached';

export interface CachedOptions {
  scope: CacheScope;
  /** Upper bound on staleness for changes made by someone else (other than staff). */
  ttlSeconds: number;
}

/**
 * Cache this GET handler's JSON response. Opt-in on purpose: never use it on responses
 * that carry signed media URLs, tokens, or anything that must be fresh per request.
 *
 * `scope: 'user'` requires JwtAuthGuard on the route; the entry is keyed by the user ID.
 */
export const Cached = (options: CachedOptions) => SetMetadata(CACHED_METADATA, options);

/** Short-lived public reads: catalogue, categories, CMS pages, settings. */
export const CachedPublic = (ttlSeconds = 60) => Cached({ scope: 'public', ttlSeconds });

/** Per-user reads: profile, my courses, wishlist, notifications. */
export const CachedForUser = (ttlSeconds = 60) => Cached({ scope: 'user', ttlSeconds });
