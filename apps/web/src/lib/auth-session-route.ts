import { TokenPairSchema } from '@obgyn/types';
import { NextResponse } from 'next/server';
import { type ZodType } from 'zod';
import { badRequest, forwardHeaders, passThrough, upstreamUnavailable } from './bff';
import { setAuthCookies } from './auth-cookies';
import { API_URL } from './env';

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

    const res = NextResponse.json({ ok: true }, { status: upstream.status });
    setAuthCookies(res, tokens.data, parsed.data.deviceId);
    return res;
  } catch {
    return upstreamUnavailable();
  }
}
