import { ACCESS_TOKEN_COOKIE } from '@obgyn/types';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { clearAuthCookies } from '@/lib/auth-cookies';
import { forwardHeaders } from '@/lib/bff';
import { API_URL } from '@/lib/env';

export async function POST(req: Request) {
  const token = (await cookies()).get(ACCESS_TOKEN_COOKIE)?.value;
  if (token) {
    // Best effort: cookies are cleared even if the API is unreachable.
    await fetch(`${API_URL}/auth/logout`, {
      method: 'POST',
      headers: forwardHeaders(req, { authorization: `Bearer ${token}` }),
    }).catch(() => undefined);
  }
  const res = new NextResponse(null, { status: 204 });
  clearAuthCookies(res);
  return res;
}
