import { ContactMessageInputSchema } from '@obgyn/types';
import { NextResponse } from 'next/server';
import { routing } from '@/i18n/routing';
import { badRequest, forwardHeaders, passThrough, upstreamUnavailable } from '@/lib/bff';
import { API_URL } from '@/lib/env';

/**
 * Public contact form → API inbox. Anonymous by design (no token is attached), validated
 * here with the same schema as the API, and rate-limited by the API per client IP.
 */
export async function POST(req: Request) {
  const body: unknown = await req.json().catch(() => null);
  const parsed = ContactMessageInputSchema.safeParse(body);
  if (!parsed.success) return badRequest();
  const requested = new URL(req.url).searchParams.get('locale') ?? '';
  const locale = (routing.locales as readonly string[]).includes(requested) ? requested : routing.defaultLocale;
  try {
    const upstream = await fetch(`${API_URL}/content/contact?locale=${locale}`, {
      method: 'POST',
      headers: forwardHeaders(req),
      body: JSON.stringify(parsed.data),
      cache: 'no-store',
    });
    return passThrough(upstream);
  } catch {
    return upstreamUnavailable();
  }
}

export function GET() {
  return NextResponse.json({ message: 'Not found' }, { status: 404 });
}
