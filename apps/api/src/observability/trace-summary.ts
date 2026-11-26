import { type Context, SpanKind } from '@opentelemetry/api';
import { type ReadableSpan, type Span, type SpanProcessor } from '@opentelemetry/sdk-trace';

/**
 * Local tracing without a trace backend (no Docker, no Jaeger): with TRACE_CONSOLE=true,
 * every HTTP request's trace is summarised into one log line when the request ends:
 *
 *   {"context":"Trace","msg":"GET /users/me/learning 200 9.8ms · db 3 queries 4.1ms",
 *    "traceId":"…","durationMs":9.8,"db":{"queries":3,"ms":4.1},
 *    "operations":["Enrollment.findMany","LessonProgress.groupBy",…],
 *    "slowest":[{"span":"prisma:engine:db_query","ms":2.3},…]}
 *
 * The trace ID is the same one the browser sees as `x-trace-id`. Only names, counts and
 * timings are recorded: never SQL parameters, request bodies or user data.
 */
export interface TraceSummary {
  traceId: string;
  method: string;
  route: string;
  status: number;
  durationMs: number;
  db: { queries: number; ms: number };
  operations: string[];
  redis: number;
  spans: number;
  slowest: Array<{ span: string; ms: number }>;
}

type Sink = (summary: TraceSummary) => void;

const ms = (span: ReadableSpan) => span.duration[0] * 1e3 + span.duration[1] / 1e6;
const round = (value: number) => Math.round(value * 10) / 10;

/** Spans of requests still in progress, by trace ID. */
interface Pending {
  firstSeen: number;
  spans: ReadableSpan[];
}

const MAX_SPANS_PER_TRACE = 1000;
const STALE_AFTER_MS = 120_000;

export class RequestSummaryProcessor implements SpanProcessor {
  private sink: Sink | null = null;
  private readonly pending = new Map<string, Pending>();
  private readonly sweeper: NodeJS.Timeout;

  constructor() {
    // Spans from work outside an HTTP request (background jobs) never get a root: drop them.
    this.sweeper = setInterval(() => {
      const cutoff = Date.now() - STALE_AFTER_MS;
      for (const [traceId, entry] of this.pending) if (entry.firstSeen < cutoff) this.pending.delete(traceId);
    }, 30_000);
    this.sweeper.unref();
  }

  setSink(sink: Sink): void {
    this.sink = sink;
  }

  onStart(_span: Span, _parentContext: Context): void {
    // Nothing to do until spans end.
  }

  onEnd(span: ReadableSpan): void {
    const traceId = span.spanContext().traceId;
    if (isRequestRoot(span)) {
      const children = this.pending.get(traceId)?.spans ?? [];
      this.pending.delete(traceId);
      if (this.sink) this.sink(summarise(traceId, span, children));
      return;
    }
    let entry = this.pending.get(traceId);
    if (!entry) {
      entry = { firstSeen: Date.now(), spans: [] };
      this.pending.set(traceId, entry);
    }
    if (entry.spans.length < MAX_SPANS_PER_TRACE) entry.spans.push(span);
  }

  async forceFlush(): Promise<void> {}

  async shutdown(): Promise<void> {
    clearInterval(this.sweeper);
    this.pending.clear();
  }
}

/** The incoming HTTP request's server span (started by the http instrumentation). */
function isRequestRoot(span: ReadableSpan): boolean {
  return span.kind === SpanKind.SERVER && span.instrumentationScope.name === '@opentelemetry/instrumentation-http';
}

function summarise(traceId: string, root: ReadableSpan, children: ReadableSpan[]): TraceSummary {
  const a = root.attributes;
  const dbSpans = children.filter((s) => s.name === 'prisma:engine:db_query');
  const operations = children
    .filter((s) => s.name === 'prisma:client:operation')
    .sort((x, y) => x.startTime[0] - y.startTime[0] || x.startTime[1] - y.startTime[1])
    .map((s) => `${String(s.attributes['model'] ?? s.attributes['db.collection.name'] ?? '$raw')}.${String(s.attributes['method'] ?? s.attributes['db.operation.name'] ?? '?')}`);
  const slowest = children
    .filter((s) => !s.name.startsWith('middleware - ') && s.name !== 'prisma:client:serialize')
    .map((s) => ({ span: s.name, ms: round(ms(s)) }))
    .sort((x, y) => y.ms - x.ms)
    .slice(0, 3);
  return {
    traceId,
    method: String(a['http.request.method'] ?? a['http.method'] ?? '?'),
    route: String(a['http.route'] ?? a['url.path'] ?? a['http.target'] ?? '?'),
    status: Number(a['http.response.status_code'] ?? a['http.status_code'] ?? 0),
    durationMs: round(ms(root)),
    db: { queries: dbSpans.length, ms: round(dbSpans.reduce((sum, s) => sum + ms(s), 0)) },
    operations,
    redis: children.filter((s) => s.instrumentationScope.name.includes('ioredis')).length,
    spans: children.length + 1,
    slowest,
  };
}
