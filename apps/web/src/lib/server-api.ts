import { ACCESS_TOKEN_COOKIE } from '@obgyn/types';
import { getLocale } from 'next-intl/server';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { type z } from 'zod';
import { routing } from '@/i18n/routing';
import { API_URL } from './env';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly body: unknown,
  ) {
    super(`API responded ${status}`);
  }
}

/**
 * A signed-in call came back 401: the session ended mid-page (signed out,
 * blocked, deleted or expired). Send the user to sign in instead of crashing.
 */
async function redirectToLogin(): Promise<never> {
  const locale = await getLocale().catch(() => routing.defaultLocale);
  redirect(`/${locale}/login`);
}

/** Server-side GET against the API, validated with a shared zod schema. */
export async function apiGet<T>(
  path: string,
  schema: z.ZodType<T, z.ZodTypeDef, unknown>,
  {
    auth = false,
    onUnauthorized = 'login',
  }: {
    auth?: boolean;
    /**
     * What a 401 on an `auth` call does: 'login' (default) redirects to the sign-in page;
     * 'throw' raises ApiError(401) for callers that handle it themselves, e.g. public
     * pages that simply show a signed-out view.
     */
    onUnauthorized?: 'login' | 'throw';
  } = {},
): Promise<T> {
  const headers: Record<string, string> = { accept: 'application/json' };
  if (auth) {
    const token = (await cookies()).get(ACCESS_TOKEN_COOKIE)?.value;
    if (!token) {
      if (onUnauthorized === 'login') await redirectToLogin();
      throw new ApiError(401, null);
    }
    headers.authorization = `Bearer ${token}`;
  }
  const res = await fetch(`${API_URL}${path}`, { headers, cache: 'no-store' });
  if (auth && res.status === 401 && onUnauthorized === 'login') await redirectToLogin();
  if (!res.ok) throw new ApiError(res.status, await res.json().catch(() => null));
  return schema.parse(await res.json());
}

export async function isSignedIn(): Promise<boolean> {
  return (await cookies()).has(ACCESS_TOKEN_COOKIE);
}
