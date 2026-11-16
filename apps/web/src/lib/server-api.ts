import { ACCESS_TOKEN_COOKIE } from '@obgyn/types';
import { cookies } from 'next/headers';
import { type z } from 'zod';
import { API_URL } from './env';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly body: unknown,
  ) {
    super(`API responded ${status}`);
  }
}

/** Server-side GET against the API, validated with a shared zod schema. */
export async function apiGet<T>(
  path: string,
  schema: z.ZodType<T, z.ZodTypeDef, unknown>,
  { auth = false }: { auth?: boolean } = {},
): Promise<T> {
  const headers: Record<string, string> = { accept: 'application/json' };
  if (auth) {
    const token = (await cookies()).get(ACCESS_TOKEN_COOKIE)?.value;
    if (!token) throw new ApiError(401, null);
    headers.authorization = `Bearer ${token}`;
  }
  const res = await fetch(`${API_URL}${path}`, { headers, cache: 'no-store' });
  if (!res.ok) throw new ApiError(res.status, await res.json().catch(() => null));
  return schema.parse(await res.json());
}

export async function isSignedIn(): Promise<boolean> {
  return (await cookies()).has(ACCESS_TOKEN_COOKIE);
}
