import { AsyncLocalStorage } from 'node:async_hooks';
import { randomBytes } from 'node:crypto';
import { trace } from '@opentelemetry/api';

/** Per-request data every log line carries, wherever in the call stack it is written. */
export interface LogContext {
  traceId: string;
  /** Set once JwtAuthGuard has identified the caller (see ObservabilityInterceptor). */
  userId?: string;
}

const storage = new AsyncLocalStorage<LogContext>();

export function runWithLogContext<T>(context: LogContext, fn: () => T): T {
  return storage.run(context, fn);
}

export function currentLogContext(): LogContext | undefined {
  return storage.getStore();
}

const TRACEPARENT = /^[\da-f]{2}-([\da-f]{32})-([\da-f]{16})-[\da-f]{2}$/;

/**
 * The trace ID for this request: the active OpenTelemetry span's when tracing is on, else
 * the one in an incoming W3C `traceparent` header (sent by the web app), else a new one.
 * Either way it matches the ID a trace backend would show.
 */
export function resolveTraceId(traceparent: string | undefined): string {
  const active = trace.getActiveSpan()?.spanContext();
  if (active && trace.isSpanContextValid(active)) return active.traceId;
  const match = traceparent ? TRACEPARENT.exec(traceparent.trim().toLowerCase()) : null;
  if (match && !/^0+$/.test(match[1]!)) return match[1]!;
  return randomBytes(16).toString('hex');
}

/** Span ID of the active span, when tracing is on. */
export function currentSpanId(): string | undefined {
  const active = trace.getActiveSpan()?.spanContext();
  return active && trace.isSpanContextValid(active) ? active.spanId : undefined;
}
