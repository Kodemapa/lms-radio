import { DEVICE_ID_COOKIE, REFRESH_TOKEN_COOKIE } from '@obgyn/types';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { clearAuthCookies, refreshTokens, setAuthCookies } from '@/lib/auth-cookies';

export async function POST() {
  const store = await cookies();
  const refreshToken = store.get(REFRESH_TOKEN_COOKIE)?.value;
  const deviceId = store.get(DEVICE_ID_COOKIE)?.value;
  const tokens = refreshToken && deviceId ? await refreshTokens(refreshToken, deviceId) : null;

  if (!tokens || !deviceId) {
    const res = NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    clearAuthCookies(res);
    return res;
  }
  const res = NextResponse.json({ ok: true });
  setAuthCookies(res, tokens, deviceId);
  return res;
}
