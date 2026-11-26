import { NextResponse } from 'next/server';
import { childTraceparent, logWeb, traceIdOf } from './trace';

/** Diagnostic headers copied from the API to the browser (never anything user-specific). */
const DIAGNOSTIC_HEADERS = ['x-trace-id', 'x-cache', 'x-session-verified'] as const;

/**
 * Headers forwarded to the API so it can rate-limit and audit by client, plus W3C trace
 * context: the browser's `traceparent` is continued (same trace ID, new span ID), or a
 * new trace starts here. The API echoes the trace ID back as `X-Trace-Id`.
 */
export function forwardHeaders(req: Request, extra: Record<string, string> = {}): Headers {
  const headers = new Headers({ 'content-type': 'application/json', accept: 'application/json' });
  const forwardedFor = req.headers.get('x-forwarded-for');
  const userAgent = req.headers.get('user-agent');
  if (forwardedFor) headers.set('x-forwarded-for', forwardedFor);
  if (userAgent) headers.set('user-agent', userAgent);
  headers.set('traceparent', childTraceparent(traceIdOf(req.headers)));
  const tracestate = req.headers.get('tracestate');
  if (tracestate && tracestate.length <= 512) headers.set('tracestate', tracestate);
  for (const [key, value] of Object.entries(extra)) headers.set(key, value);
  return headers;
}

/** Copy the API's trace ID and cache result onto a response built here. */
export function withDiagnostics<T extends Response>(res: T, upstream: Response | null, traceId?: string): T {
  for (const name of DIAGNOSTIC_HEADERS) {
    const value = upstream?.headers.get(name);
    if (value) res.headers.set(name, value);
  }
  if (!res.headers.has('x-trace-id') && traceId) res.headers.set('x-trace-id', traceId);
  return res;
}

/** Pass an upstream API response straight through (diagnostic headers included, 204s too). */
export async function passThrough(upstream: Response): Promise<NextResponse> {
  if (upstream.status === 204) return withDiagnostics(new NextResponse(null, { status: 204, headers: { 'cache-control': 'no-store' } }), upstream);
  // Bytes, not text: decoding as text would drop a UTF-8 BOM (CSV exports for Excel).
  const disposition = upstream.headers.get('content-disposition');
  const headers: Record<string, string> = {
    'content-type': upstream.headers.get('content-type') ?? 'application/json',
    // The API may cache per user on the server; the browser and any CDN must never keep a copy.
    'cache-control': 'private, no-store',
    ...(disposition ? { 'content-disposition': disposition } : {}),
  };
  return withDiagnostics(new NextResponse(await upstream.arrayBuffer(), { status: upstream.status, headers }), upstream);
}

/**
 * One access-log line for a BFF call: method, API path (no query string: media grants and
 * search terms stay out of logs), status, duration, API cache result and the trace ID that
 * also appears on the API's own line.
 */
export function logBffCall(method: string, path: string, started: number, upstream: Response | null, status = upstream?.status ?? 503): void {
  const durationMs = Math.round((performance.now() - started) * 10) / 10;
  const cleanPath = `/${path.split('?')[0]}`.replace(/^\/+/, '/');
  const cache = upstream?.headers.get('x-cache') ?? undefined;
  logWeb(status >= 500 ? 'error' : status >= 400 ? 'warn' : 'info', 'BFF', `${method} ${cleanPath} ${status} ${durationMs}ms`, {
    traceId: upstream?.headers.get('x-trace-id') ?? undefined,
    http: { method, path: cleanPath, status, durationMs, ...(cache ? { cache } : {}) },
  });
}

export function badRequest(message = 'Invalid input'): NextResponse {
  return NextResponse.json({ message }, { status: 400 });
}

export function upstreamUnavailable(): NextResponse {
  return NextResponse.json({ message: 'Service unavailable' }, { status: 503 });
}
