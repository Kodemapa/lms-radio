import { describe, expect, it } from 'vitest';
import { forwardHeaders, passThrough } from './bff';
import { childTraceparent, newTraceId, traceIdFrom, traceIdOf } from './trace';

const TRACE = '4bf92f3577b34da6a3ce929d0e0e4736';

describe('trace context', () => {
  it('reads the trace ID of a W3C traceparent and rejects invalid ones', () => {
    expect(traceIdFrom(`00-${TRACE}-00f067aa0ba902b7-01`)).toBe(TRACE);
    expect(traceIdFrom(`00-${'0'.repeat(32)}-00f067aa0ba902b7-01`)).toBeNull();
    expect(traceIdFrom('garbage')).toBeNull();
    expect(traceIdFrom(null)).toBeNull();
  });

  it('continues a trace with a new span ID per call', () => {
    const a = childTraceparent(TRACE);
    const b = childTraceparent(TRACE);
    expect(traceIdFrom(a)).toBe(TRACE);
    expect(a).not.toBe(b);
  });

  it("uses the caller's trace, or starts one", () => {
    expect(traceIdOf(new Headers({ traceparent: `00-${TRACE}-00f067aa0ba902b7-01` }))).toBe(TRACE);
    expect(traceIdOf(new Headers())).toMatch(/^[\da-f]{32}$/);
    expect(newTraceId()).not.toBe(newTraceId());
  });
});

describe('BFF trace propagation', () => {
  it("forwards the browser's trace to the API", () => {
    const req = new Request('http://web/api/proxy/users/me', { headers: { traceparent: `00-${TRACE}-00f067aa0ba902b7-01` } });
    expect(traceIdFrom(forwardHeaders(req).get('traceparent'))).toBe(TRACE);
  });

  it('starts a trace when the browser sent none', () => {
    expect(traceIdFrom(forwardHeaders(new Request('http://web/api/proxy/users/me')).get('traceparent'))).toMatch(/^[\da-f]{32}$/);
  });

  it('returns the trace ID and cache result on every response, 204s included', async () => {
    const headers = { 'x-trace-id': TRACE, 'x-cache': 'HIT', 'x-session-verified': '1' };
    const ok = await passThrough(new Response('{}', { status: 200, headers }));
    const empty = await passThrough(new Response(null, { status: 204, headers }));
    for (const res of [ok, empty]) {
      expect(res.headers.get('x-trace-id')).toBe(TRACE);
      expect(res.headers.get('x-cache')).toBe('HIT');
      expect(res.headers.get('cache-control')).toMatch(/no-store/);
    }
    expect(ok.headers.get('cache-control')).toBe('private, no-store');
  });
});
