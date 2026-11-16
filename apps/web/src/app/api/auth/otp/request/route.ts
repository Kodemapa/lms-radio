import { OtpRequestSchema } from '@obgyn/types';
import { badRequest, forwardHeaders, passThrough, upstreamUnavailable } from '@/lib/bff';
import { API_URL } from '@/lib/env';

export async function POST(req: Request) {
  const body = OtpRequestSchema.safeParse(await req.json().catch(() => null));
  if (!body.success) return badRequest();
  try {
    const upstream = await fetch(`${API_URL}/auth/otp/request`, {
      method: 'POST',
      headers: forwardHeaders(req),
      body: JSON.stringify(body.data),
    });
    return passThrough(upstream);
  } catch {
    return upstreamUnavailable();
  }
}
