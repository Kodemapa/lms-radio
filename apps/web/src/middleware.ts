import { DEVICE_ID_COOKIE, REFRESH_TOKEN_COOKIE, ACCESS_TOKEN_COOKIE } from '@obgyn/types';
import createIntlMiddleware from 'next-intl/middleware';
import { NextResponse, type NextRequest } from 'next/server';
import { routing } from './i18n/routing';
import { clearAuthCookies, refreshTokens, setAuthCookies } from './lib/auth-cookies';
import { isProtectedPath, localeFromPath } from './lib/paths';
import { childTraceparent, traceIdOf } from './lib/trace';

const intl = createIntlMiddleware(routing);

/**
 * Counts quick retries after a refresh that lost a race with another request (or found
 * the API briefly unreachable). Short-lived, so a stuck retry can never loop.
 */
const RETRY_COOKIE = 'elms_refresh_retry';
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 300;

/**
 * Every page request (full load or in-app navigation) gets one trace ID: the browser's own
 * `traceparent` if it sent one, otherwise a new one. It is returned as `x-trace-id` and
 * handed to server rendering as a `traceparent` request header, so all API calls made to
 * render this page carry the same ID (see lib/trace.ts and lib/server-api.ts).
 */
export default async function middleware(req: NextRequest) {
  const traceId = traceIdOf(req.headers);
  const res = await route(req);
  res.headers.set('x-trace-id', traceId);
  if (!res.headers.has('location')) forwardRequestHeader(req, res, 'traceparent', childTraceparent(traceId));
  return res;
}

/**
 * Adds a request header for the page render, the way `NextResponse.next({ request: { headers } })`
 * does, but on a response that next-intl already built (which may carry its own request
 * header overrides; those are kept).
 */
function forwardRequestHeader(req: NextRequest, res: NextResponse, name: string, value: string): void {
  const headers = new Headers(req.headers);
  const overridden = res.headers.get('x-middleware-override-headers');
  if (overridden) {
    for (const key of overridden.split(',')) {
      const carried = res.headers.get(`x-middleware-request-${key}`);
      if (carried === null) headers.delete(key);
      else headers.set(key, carried);
    }
  }
  headers.set(name, value);
  const carrier = NextResponse.next({ request: { headers } });
  carrier.headers.forEach((v, key) => {
    if (key === 'x-middleware-override-headers' || key.startsWith('x-middleware-request-')) res.headers.set(key, v);
  });
}

async function route(req: NextRequest): Promise<NextResponse> {
  const { pathname, search } = req.nextUrl;

  if (!req.cookies.has(ACCESS_TOKEN_COOKIE)) {
    const refreshToken = req.cookies.get(REFRESH_TOKEN_COOKIE)?.value;
    const deviceId = req.cookies.get(DEVICE_ID_COOKIE)?.value;

    if (refreshToken && deviceId) {
      const result = await refreshTokens(refreshToken, deviceId, req.headers.get('x-forwarded-for'));

      if (result.kind === 'ok') {
        const res = NextResponse.redirect(req.nextUrl);
        setAuthCookies(res, result.tokens, deviceId);
        res.cookies.delete(RETRY_COOKIE);
        return res;
      }

      // Another request from this browser refreshed a moment ago (its new cookies are
      // arriving), or the API blipped. The session is still valid: wait briefly and load
      // the page again with whatever cookies the browser has by then. Never sign out here.
      if (result.kind === 'race' || result.kind === 'unavailable') {
        const tries = Number(req.cookies.get(RETRY_COOKIE)?.value ?? 0);
        if (tries < MAX_RETRIES) {
          await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
          const res = NextResponse.redirect(req.nextUrl);
          res.cookies.set(RETRY_COOKIE, String(tries + 1), { path: '/', maxAge: 30, sameSite: 'strict', httpOnly: true });
          return res;
        }
        // Still not refreshed: carry on without signing out. Protected pages go to sign-in,
        // but the session cookies stay, so the next request can still refresh.
        if (isProtectedPath(pathname)) {
          const login = req.nextUrl.clone();
          login.pathname = `/${localeFromPath(pathname)}/login`;
          login.search = `?next=${encodeURIComponent(pathname + search)}`;
          return NextResponse.redirect(login);
        }
        return intl(req);
      }
    }

    // No session, or the session is over (signed out, revoked, expired, blocked).
    if (isProtectedPath(pathname)) {
      const login = req.nextUrl.clone();
      login.pathname = `/${localeFromPath(pathname)}/login`;
      login.search = `?next=${encodeURIComponent(pathname + search)}`;
      const res = NextResponse.redirect(login);
      if (refreshToken) clearAuthCookies(res);
      return res;
    }

    const res = intl(req);
    if (refreshToken) clearAuthCookies(res);
    return res;
  }

  return intl(req);
}

export const config = {
  // Everything except API routes, Next internals and files with an extension.
  matcher: '/((?!api|_next|dev/_next|_vercel|.*\\..*).*)',
};
