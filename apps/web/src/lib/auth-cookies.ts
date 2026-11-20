import {
  ACCESS_TOKEN_COOKIE,
  AUTH_ERROR_CODES,
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
/**
 * The access cookie disappears this long before the token itself expires, so the
 * middleware refreshes the session ahead of time. Otherwise a request sent in the
 * token's last moment reaches the API already expired and the page signs the user out.
 */
const ACCESS_COOKIE_EARLY_EXPIRY_SECONDS = 60;

/** Tokens live only in httpOnly cookies; page JavaScript never sees them. */
export function setAuthCookies(res: NextResponse, tokens: TokenPair, deviceId: string): void {
  res.cookies.set(ACCESS_TOKEN_COOKIE, tokens.accessToken, {
    ...base,
    maxAge: Math.max(30, tokens.accessTokenExpiresIn - ACCESS_COOKIE_EARLY_EXPIRY_SECONDS),
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

/**
 * Result of a token refresh. Only `invalid` means the session is over (signed out,
 * revoked, expired, blocked). `race`: another request from this browser refreshed a
 * moment ago, so its new cookies are on the way. `unavailable`: the API couldn't be
 * reached. Neither of those may sign the user out.
 */
export type RefreshResult =
  | { kind: 'ok'; tokens: TokenPair }
  | { kind: 'invalid' }
  | { kind: 'race' }
  | { kind: 'unavailable' };

export async function refreshTokens(
  refreshToken: string,
  deviceId: string,
  /** The visitor's IP chain, so the API rate-limits per visitor, not per web server. */
  forwardedFor?: string | null,
): Promise<RefreshResult> {
  try {
    const res = await fetch(`${API_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...(forwardedFor ? { 'x-forwarded-for': forwardedFor } : {}) },
      body: JSON.stringify({ refreshToken, deviceId }),
      cache: 'no-store',
    });
    if (res.status === 409) {
      const body = (await res.json().catch(() => null)) as { code?: string } | null;
      if (body?.code === AUTH_ERROR_CODES.refreshRace) return { kind: 'race' };
    }
    if (res.status === 400 || res.status === 401 || res.status === 403) return { kind: 'invalid' };
    if (!res.ok) return { kind: 'unavailable' };
    const parsed = TokenPairSchema.safeParse(await res.json());
    return parsed.success ? { kind: 'ok', tokens: parsed.data } : { kind: 'unavailable' };
  } catch {
    return { kind: 'unavailable' };
  }
}
