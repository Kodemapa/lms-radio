import { AUTH_ERROR_CODES, DEVICE_ID_COOKIE, REFRESH_TOKEN_COOKIE } from '@obgyn/types';
import { cookies, headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { clearAuthCookies, refreshTokens, setAuthCookies } from '@/lib/auth-cookies';

/**
 * Browser-side token refresh. Cookies are cleared only when the session is really over;
 * a race with another refresh (409) or an unreachable API (503) leaves them alone, so a
 * hiccup never signs the user out.
 */
export async function POST() {
  const store = await cookies();
  const refreshToken = store.get(REFRESH_TOKEN_COOKIE)?.value;
  const deviceId = store.get(DEVICE_ID_COOKIE)?.value;
  const forwardedFor = (await headers()).get('x-forwarded-for');
  const result =
    refreshToken && deviceId ? await refreshTokens(refreshToken, deviceId, forwardedFor) : ({ kind: 'invalid' } as const);

  if (result.kind === 'race') {
    return NextResponse.json({ code: AUTH_ERROR_CODES.refreshRace }, { status: 409 });
  }
  if (result.kind === 'unavailable') {
    return NextResponse.json({ message: 'Service unavailable' }, { status: 503 });
  }
  if (result.kind === 'invalid' || !deviceId) {
    const res = NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    clearAuthCookies(res);
    return res;
  }
  const res = NextResponse.json({ ok: true });
  setAuthCookies(res, result.tokens, deviceId);
  return res;
}
