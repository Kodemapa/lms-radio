import { NextResponse } from 'next/server';
import { upstreamUnavailable } from '@/lib/bff';
import { API_URL } from '@/lib/env';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Public images (profile pictures, course thumbnails, certificate logos) served from our
 * own site, so they load without a separate public API address. The API decides what is
 * public; this only forwards. S3 storage answers with a short-lived redirect, passed on.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) return new NextResponse(null, { status: 404 });
  try {
    const upstream = await fetch(`${API_URL}/files/${id}`, { redirect: 'manual', cache: 'no-store' });
    const location = upstream.headers.get('location');
    if (upstream.status >= 300 && upstream.status < 400 && location) {
      return NextResponse.redirect(location, { status: 302, headers: { 'cache-control': 'public, max-age=240' } });
    }
    if (!upstream.ok || !upstream.body) return new NextResponse(null, { status: upstream.status === 404 ? 404 : 502 });
    return new NextResponse(upstream.body, {
      status: 200,
      headers: {
        'content-type': upstream.headers.get('content-type') ?? 'application/octet-stream',
        'cache-control': upstream.headers.get('cache-control') ?? 'public, max-age=86400',
        'x-content-type-options': 'nosniff',
      },
    });
  } catch {
    return upstreamUnavailable();
  }
}
