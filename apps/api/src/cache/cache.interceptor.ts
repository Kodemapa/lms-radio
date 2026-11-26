import { type CallHandler, type ExecutionContext, Injectable, type NestInterceptor } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { type Request, type Response } from 'express';
import { catchError, concatMap, from, mergeMap, type Observable, of, tap, throwError } from 'rxjs';
import { type AuthUser } from '../auth/auth-user';
import { CacheService } from './cache.service';
import { CACHED_METADATA, type CachedOptions } from './cached.decorator';

const READ_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Global interceptor (runs after guards, so `req.user` is known):
 *  - GET on a `@Cached` handler: serve from cache, or run the handler and store the result.
 *    Sets `X-Cache: HIT|MISS`; user-scope responses also get `Cache-Control: private,
 *    no-store` so a browser or proxy never keeps one user's data for the next person.
 *  - Any write by a signed-in user: invalidate before the response is sent, so the very
 *    next read already sees the change.
 */
@Injectable()
export class CacheInterceptor implements NestInterceptor {
  constructor(
    private readonly cache: CacheService,
    private readonly reflector: Reflector,
  ) {}

  async intercept(ctx: ExecutionContext, next: CallHandler): Promise<Observable<unknown>> {
    if (ctx.getType() !== 'http') return next.handle();
    const req = ctx.switchToHttp().getRequest<Request & { user?: AuthUser }>();
    const res = ctx.switchToHttp().getResponse<Response>();

    if (!READ_METHODS.has(req.method)) {
      if (!this.cache.enabled) return next.handle();
      const invalidate = () => from(this.cache.afterWrite(req.user));
      return next.handle().pipe(
        concatMap((value) => invalidate().pipe(mergeMap(() => of(value)))),
        catchError((error: unknown) => invalidate().pipe(mergeMap(() => throwError(() => error)))),
      );
    }

    const options = this.reflector.getAllAndOverride<CachedOptions | undefined>(CACHED_METADATA, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (!options || req.method !== 'GET') return next.handle();

    // Per-user answers: no browser, proxy or CDN may keep them (the default is no-store too).
    if (options.scope === 'user') res.setHeader('Cache-Control', 'private, no-store');
    // Public answers may be cached by a CDN / shared cache: set on success only, so an
    // error (e.g. a 404 for a course about to be published) is never cached at the edge.
    const markPublic = () => {
      if (options.scope === 'public') res.setHeader('Cache-Control', publicCacheControl(options.ttlSeconds));
    };
    const key = await this.cache.keyFor(options.scope, req.originalUrl, req.user?.userId, req.user?.role);
    if (!key) return next.handle().pipe(tap(markPublic));

    const hit = await this.cache.get(key);
    if (hit !== undefined) {
      res.setHeader('X-Cache', 'HIT');
      markPublic();
      return of(hit);
    }
    res.setHeader('X-Cache', 'MISS');
    return next.handle().pipe(
      tap((value) => {
        markPublic();
        void this.cache.set(key, value, options.ttlSeconds);
      }),
    );
  }
}

/**
 * Browsers keep a public answer up to 60 s; shared caches (CDN) for the endpoint's TTL,
 * then serve it stale for as long again while fetching a fresh copy in the background.
 */
export function publicCacheControl(ttlSeconds: number): string {
  return `public, max-age=${Math.min(60, ttlSeconds)}, s-maxage=${ttlSeconds}, stale-while-revalidate=${ttlSeconds}`;
}
