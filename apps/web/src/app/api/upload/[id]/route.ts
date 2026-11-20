import { ACCESS_TOKEN_COOKIE } from '@obgyn/types';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { passThrough, upstreamUnavailable } from '@/lib/bff';
import { API_URL } from '@/lib/env';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Chunks are small (the browser sends at most this much per request). */
const MAX_CHUNK_BYTES = 8 * 1024 * 1024;

/**
 * One chunk of a file upload, sent to our own site and forwarded to the API with the
 * signed-in user's token. This is the fallback when the browser can't upload straight to
 * storage (bucket CORS, wrong public API address, http/https mismatch, proxy body limit):
 * same origin, short requests, so none of those apply.
 */
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const offset = new URL(req.url).searchParams.get('offset') ?? '0';
  if (!UUID.test(id) || !/^\d{1,13}$/.test(offset)) {
    return NextResponse.json({ message: 'Not found' }, { status: 404 });
  }
  const token = (await cookies()).get(ACCESS_TOKEN_COOKIE)?.value;
  if (!token) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  const body = await req.arrayBuffer();
  if (body.byteLength > MAX_CHUNK_BYTES) {
    return NextResponse.json({ code: 'CHUNK_TOO_LARGE', message: 'Upload chunk too large' }, { status: 413 });
  }
  const forwardedFor = req.headers.get('x-forwarded-for');
  try {
    const upstream = await fetch(`${API_URL}/uploads/${id}/content?offset=${offset}`, {
      method: 'PUT',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/octet-stream',
        ...(forwardedFor ? { 'x-forwarded-for': forwardedFor } : {}),
      },
      body,
      cache: 'no-store',
    });
    return passThrough(upstream);
  } catch {
    return upstreamUnavailable();
  }
}
