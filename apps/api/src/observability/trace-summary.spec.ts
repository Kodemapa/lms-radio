import { SpanKind } from '@opentelemetry/api';
import { type ReadableSpan } from '@opentelemetry/sdk-trace';
import { RequestSummaryProcessor, type TraceSummary } from './trace-summary';

const TRACE = '4bf92f3577b34da6a3ce929d0e0e4736';

function span(name: string, msTaken: number, extra: Partial<ReadableSpan> = {}, attributes: Record<string, string | number> = {}): ReadableSpan {
  return {
    name,
    kind: SpanKind.INTERNAL,
    spanContext: () => ({ traceId: TRACE, spanId: Math.random().toString(16).slice(2, 18).padEnd(16, '0'), traceFlags: 1 }),
    startTime: [0, 0],
    endTime: [0, 0],
    duration: [Math.floor(msTaken / 1000), (msTaken % 1000) * 1e6],
    attributes,
    instrumentationScope: { name: 'prisma' },
    ...extra,
  } as unknown as ReadableSpan;
}

describe('RequestSummaryProcessor', () => {
  it('summarises a request: duration, DB queries and time, operations, slowest steps', () => {
    const processor = new RequestSummaryProcessor();
    const summaries: TraceSummary[] = [];
    processor.setSink((s) => summaries.push(s));

    processor.onEnd(span('prisma:client:operation', 6, {}, { model: 'Enrollment', method: 'findMany' }));
    processor.onEnd(span('prisma:engine:db_query', 2.5));
    processor.onEnd(span('prisma:engine:db_query', 1.5));
    processor.onEnd(span('middleware - jsonParser', 0.2, { instrumentationScope: { name: '@opentelemetry/instrumentation-express' } } as Partial<ReadableSpan>));
    processor.onEnd(
      span(
        'GET',
        12.34,
        { kind: SpanKind.SERVER, instrumentationScope: { name: '@opentelemetry/instrumentation-http' } } as Partial<ReadableSpan>,
        { 'http.request.method': 'GET', 'http.route': '/users/me/learning', 'http.response.status_code': 200 },
      ),
    );

    expect(summaries).toHaveLength(1);
    expect(summaries[0]).toMatchObject({
      traceId: TRACE,
      method: 'GET',
      route: '/users/me/learning',
      status: 200,
      durationMs: 12.3,
      db: { queries: 2, ms: 4 },
      operations: ['Enrollment.findMany'],
    });
    expect(summaries[0]!.slowest[0]).toEqual({ span: 'prisma:client:operation', ms: 6 });
    // Express middleware noise is left out of "slowest".
    expect(summaries[0]!.slowest.some((s) => s.span.startsWith('middleware'))).toBe(false);
    void processor.shutdown();
  });
});
