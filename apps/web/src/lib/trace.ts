/**
 * W3C trace context for the web server (middleware, BFF route handlers, server rendering).
 *
 * One trace ID follows a request end to end:
 *   browser ──(page request)──► middleware: adopts the browser's `traceparent` or makes one,
 *                               returns it as `x-trace-id`, hands it to server rendering
 *   server render ──apiGet──►  API (same trace ID, new span ID per call)
 *   browser ──/api/proxy/*──►  BFF route: same idea, `x-trace-id` on every response
 * The API logs the same ID on its access-log line (and in its OpenTelemetry spans), so
 * the ID from the browser's Network tab finds every related log line in both terminals.
 *
 * Edge-runtime safe (middleware): Web Crypto only, no Node APIs.
 */
const TRACEPARENT = /^[\da-f]{2}-([\da-f]{32})-[\da-f]{16}-[\da-f]{2}$/;

function hex(bytes: number): string {
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  return Array.from(buf, (b) => b.toString(16).padStart(2, '0')).join('');
}

/** The trace ID in a `traceparent` header, or null if absent/invalid. */
export function traceIdFrom(traceparent: string | null | undefined): string | null {
  const match = traceparent ? TRACEPARENT.exec(traceparent.trim().toLowerCase()) : null;
  return match && !/^0+$/.test(match[1]!) ? match[1]! : null;
}

export function newTraceId(): string {
  return hex(16);
}

/** A `traceparent` continuing `traceId` with a fresh span ID (one per outgoing call). */
export function childTraceparent(traceId: string): string {
  return `00-${traceId}-${hex(8)}-01`;
}

export function newTraceparent(): { traceparent: string; traceId: string } {
  const traceId = newTraceId();
  return { traceparent: childTraceparent(traceId), traceId };
}

/** The request's trace ID: the caller's (browser or middleware) or a new one. */
export function traceIdOf(headers: Headers): string {
  return traceIdFrom(headers.get('traceparent')) ?? newTraceId();
}

type Level = 'info' | 'warn' | 'error';

/**
 * One JSON line on the web server's output, in the same shape as the API's log lines
 * (`time`, `level`, `context`, `msg`, `traceId`), so both terminals can be searched alike.
 * `LOG_REQUESTS=false` silences the per-request lines; warnings and errors always print.
 */
export function logWeb(level: Level, context: string, msg: string, fields: Record<string, unknown> = {}): void {
  if (level === 'info' && process.env.LOG_REQUESTS === 'false') return;
  const line = JSON.stringify({ time: new Date().toISOString(), level, service: 'web', context, msg, ...fields });
  if (level === 'info') console.log(line);
  else console.error(line);
}

/** One structured line for a server-side API call that failed. */
export function logApiFailure({
  level,
  ...fields
}: {
  method: string;
  path: string;
  status: number;
  traceId: string;
  durationMs: number;
  /** Why no HTTP answer came back (connection refused, timeout), when that is the failure. */
  cause?: string;
  /** Overrides the default: error for 5xx, warn otherwise. */
  level?: Exclude<Level, 'info'>;
}): void {
  const path = fields.path.split('?')[0]!;
  logWeb(level ?? (fields.status >= 500 ? 'error' : 'warn'), 'web→api', `${fields.method} ${path} ${fields.status}`, { ...fields, path });
}
