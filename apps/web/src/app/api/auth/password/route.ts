import { ACCESS_TOKEN_COOKIE, ChangePasswordSchema } from '@obgyn/types';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { badRequest, forwardHeaders, passThrough, upstreamUnavailable } from '@/lib/bff';
import { API_URL } from '@/lib/env';

export async function POST(req: Request) {
  const parsed = ChangePasswordSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest();

  const token = (await cookies()).get(ACCESS_TOKEN_COOKIE)?.value;
  if (!token) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  try {
    const upstream = await fetch(`${API_URL}/auth/password`, {
      method: 'POST',
      headers: forwardHeaders(req, { authorization: `Bearer ${token}` }),
      body: JSON.stringify(parsed.data),
    });
    return passThrough(upstream);
  } catch {
    return upstreamUnavailable();
  }
}
