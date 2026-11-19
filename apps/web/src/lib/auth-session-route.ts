import { TokenPairSchema } from '@obgyn/types';
import { NextResponse } from 'next/server';
import { type ZodType } from 'zod';
import { badRequest, forwardHeaders, passThrough, upstreamUnavailable } from './bff';
import { setAuthCookies } from './auth-cookies';
import { API_URL } from './env';

/**
 * Reads the role claim from a freshly issued access token. Only used to pick the
 * landing page; the API still checks the signed token on every request.
 */
export function roleFromToken(token: string): string | null {
  try {
    const payload = JSON.parse(Buffer.from(token.split('.')[1] ?? '', 'base64url').toString('utf8')) as { role?: unknown };
    return typeof payload.role === 'string' ? payload.role : null;
  } catch {
    return null;
  }
}

export async function createAuthSession<T extends { deviceId: string }>(
  req: Request,
  path: string,
  schema: ZodType<T>,
): Promise<NextResponse> {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest();

  try {
    const upstream = await fetch(`${API_URL}/auth/${path}`, {
      method: 'POST',
      headers: forwardHeaders(req),
      body: JSON.stringify(parsed.data),
    });
    if (!upstream.ok) return passThrough(upstream);

    const tokens = TokenPairSchema.safeParse(await upstream.json());
    if (!tokens.success) return upstreamUnavailable();

    // The role lets the sign-in page go straight to the right dashboard without another API call.
    const res = NextResponse.json({ ok: true, role: roleFromToken(tokens.data.accessToken) }, { status: upstream.status });
    setAuthCookies(res, tokens.data, parsed.data.deviceId);
    return res;
  } catch {
    return upstreamUnavailable();
  }
}
