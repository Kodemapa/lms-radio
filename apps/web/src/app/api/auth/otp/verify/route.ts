import { OtpVerifySchema, TokenPairSchema } from '@obgyn/types';
import { NextResponse } from 'next/server';
import { setAuthCookies } from '@/lib/auth-cookies';
import { badRequest, forwardHeaders, passThrough, upstreamUnavailable } from '@/lib/bff';
import { API_URL } from '@/lib/env';

export async function POST(req: Request) {
  const body = OtpVerifySchema.safeParse(await req.json().catch(() => null));
  if (!body.success) return badRequest();

  let upstream: Response;
  try {
    upstream = await fetch(`${API_URL}/auth/otp/verify`, {
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
