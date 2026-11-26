import { OtpVerifySchema, TokenPairSchema } from '@obgyn/types';
import { NextResponse } from 'next/server';
import { badRequest, forwardHeaders, passThrough, upstreamUnavailable, withDiagnostics } from '@/lib/bff';
import { identityFromToken } from '@/lib/auth-session-route';
import { setAuthCookies } from '@/lib/auth-cookies';
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

  const res = withDiagnostics(
    NextResponse.json({ ok: true, ...identityFromToken(tokens.data.accessToken) }),
    upstream,
  );
  setAuthCookies(res, tokens.data, body.data.deviceId);
  return res;
}
