import { PasswordResetSchema } from '@obgyn/types';
import { badRequest, forwardHeaders, passThrough, upstreamUnavailable } from '@/lib/bff';
import { API_URL } from '@/lib/env';

export async function POST(req: Request) {
  const parsed = PasswordResetSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest();
  try {
    const upstream = await fetch(`${API_URL}/auth/password/reset`, {
      method: 'POST',
      headers: forwardHeaders(req),
      body: JSON.stringify(parsed.data),
    });
    return passThrough(upstream);
  } catch {
    return upstreamUnavailable();
  }
}
