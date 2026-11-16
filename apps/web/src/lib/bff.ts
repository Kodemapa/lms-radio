import { NextResponse } from 'next/server';

/** Headers forwarded to the API so it can rate-limit and audit by client. */
export function forwardHeaders(req: Request, extra: Record<string, string> = {}): Headers {
  const headers = new Headers({ 'content-type': 'application/json', accept: 'application/json' });
  const forwardedFor = req.headers.get('x-forwarded-for');
  const userAgent = req.headers.get('user-agent');
  if (forwardedFor) headers.set('x-forwarded-for', forwardedFor);
  if (userAgent) headers.set('user-agent', userAgent);
  for (const [key, value] of Object.entries(extra)) headers.set(key, value);
  return headers;
}

/** Pass an upstream API response straight through. */
export async function passThrough(upstream: Response): Promise<NextResponse> {
  if (upstream.status === 204) return new NextResponse(null, { status: 204 });
  // Bytes, not text: decoding as text would drop a UTF-8 BOM (CSV exports for Excel).
  const disposition = upstream.headers.get('content-disposition');
  return new NextResponse(await upstream.arrayBuffer(), {
    status: upstream.status,
    headers: {
      'content-type': upstream.headers.get('content-type') ?? 'application/json',
      'cache-control': 'no-store',
      ...(disposition ? { 'content-disposition': disposition } : {}),
    },
  });
}

export function badRequest(message = 'Invalid input'): NextResponse {
  return NextResponse.json({ message }, { status: 400 });
}

export function upstreamUnavailable(): NextResponse {
  return NextResponse.json({ message: 'Service unavailable' }, { status: 503 });
}
