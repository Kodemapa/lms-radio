import { DEVICE_ID_COOKIE, REFRESH_TOKEN_COOKIE, ACCESS_TOKEN_COOKIE } from '@obgyn/types';
import createIntlMiddleware from 'next-intl/middleware';
import { NextResponse, type NextRequest } from 'next/server';
import { routing } from './i18n/routing';
import { clearAuthCookies, refreshTokens, setAuthCookies } from './lib/auth-cookies';
import { isProtectedPath, localeFromPath } from './lib/paths';

const intl = createIntlMiddleware(routing);

export default async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  if (!req.cookies.has(ACCESS_TOKEN_COOKIE)) {
    const refreshToken = req.cookies.get(REFRESH_TOKEN_COOKIE)?.value;
    const deviceId = req.cookies.get(DEVICE_ID_COOKIE)?.value;
    const tokens = refreshToken && deviceId ? await refreshTokens(refreshToken, deviceId) : null;

    if (tokens && deviceId) {
      const res = NextResponse.redirect(req.nextUrl);
      setAuthCookies(res, tokens, deviceId);
      return res;
    }

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
  matcher: '/((?!api|_next|_vercel|.*\\..*).*)',
};
