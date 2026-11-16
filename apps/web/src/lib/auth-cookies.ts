import {
  ACCESS_TOKEN_COOKIE,
  DEVICE_ID_COOKIE,
  REFRESH_TOKEN_COOKIE,
  TokenPairSchema,
  type TokenPair,
} from '@obgyn/types';
import { type NextResponse } from 'next/server';
import { API_URL } from './env';

const secure = process.env.NODE_ENV === 'production';
const base = { httpOnly: true, secure, sameSite: 'strict' as const, path: '/' };
const DEVICE_COOKIE_MAX_AGE = 400 * 24 * 60 * 60;

/** Tokens live only in httpOnly cookies; page JavaScript never sees them. */
export function setAuthCookies(res: NextResponse, tokens: TokenPair, deviceId: string): void {
  res.cookies.set(ACCESS_TOKEN_COOKIE, tokens.accessToken, {
    ...base,
    maxAge: tokens.accessTokenExpiresIn,
  });
  res.cookies.set(REFRESH_TOKEN_COOKIE, tokens.refreshToken, {
    ...base,
    expires: new Date(tokens.refreshTokenExpiresAt),
  });
  res.cookies.set(DEVICE_ID_COOKIE, deviceId, { ...base, maxAge: DEVICE_COOKIE_MAX_AGE });
}

/** Sign-out clears the tokens but keeps the device id, so the device stays bound. */
export function clearAuthCookies(res: NextResponse): void {
  res.cookies.delete(ACCESS_TOKEN_COOKIE);
  res.cookies.delete(REFRESH_TOKEN_COOKIE);
}

export async function refreshTokens(refreshToken: string, deviceId: string): Promise<TokenPair | null> {
  try {
    const res = await fetch(`${API_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ refreshToken, deviceId }),
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const parsed = TokenPairSchema.safeParse(await res.json());
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
