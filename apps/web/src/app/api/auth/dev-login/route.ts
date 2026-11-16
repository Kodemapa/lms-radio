import { TokenPairSchema } from '@obgyn/types';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { setAuthCookies } from '@/lib/auth-cookies';
import { badRequest, forwardHeaders, passThrough, upstreamUnavailable } from '@/lib/bff';
import { API_URL } from '@/lib/env';

const DevLoginSchema = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(1).max(100),
  deviceId: z.string().uuid(),
  deviceLabel: z.string().max(100).optional(),
});

/** Development only: email + fixed dev password. The API refuses it in production too. */
export async function POST(req: Request) {
  if (process.env.NODE_ENV === 'production') return NextResponse.json({ message: 'Not found' }, { status: 404 });
  const body = DevLoginSchema.safeParse(await req.json().catch(() => null));
  if (!body.success) return badRequest();

  let upstream: Response;
  try {
    upstream = await fetch(`${API_URL}/auth/dev-login`, {
      method: 'POST',
      headers: forwardHeaders(req),
      body: JSON.stringify(body.data),
    });
  } catch {
    return upstreamUnavailable();
  }
  if (!upstream.ok) return passThrough(upstream);

  const tokens = TokenPairSchema.safeParse(await upstream.json());
  if (!tokens.success) return upstreamUnavailable();

  const res = NextResponse.json({ ok: true });
  setAuthCookies(res, tokens.data, body.data.deviceId);
  return res;
}
