import { Logger } from '@nestjs/common';
import { AppLogger, type LogRecord } from './app-logger';
import { safeUrlPath } from './redact';
import { currentLogContext, resolveTraceId, runWithLogContext } from './request-context';

function capture(level: ConstructorParameters<typeof AppLogger>[0] = 'debug') {
  const lines: LogRecord[] = [];
  const logger = new AppLogger(level, 'json', (line) => lines.push(JSON.parse(line) as LogRecord));
  return { logger, lines };
}

describe('AppLogger', () => {
  it('writes JSON with context, trace ID and user ID from the request context', () => {
    const { logger, lines } = capture();
    runWithLogContext({ traceId: 'a'.repeat(32), userId: 'user-1' }, () => logger.log('hello', 'Courses'));
    expect(lines[0]).toMatchObject({ level: 'info', context: 'Courses', msg: 'hello', traceId: 'a'.repeat(32), userId: 'user-1' });
  });

  it('serialises errors passed the way existing services pass them', () => {
    const { logger, lines } = capture();
    logger.error('Audit write failed', new Error('db down'), 'AuditService');
    expect(lines[0]).toMatchObject({ level: 'error', context: 'AuditService', msg: 'Audit write failed', err: { message: 'db down' } });
    expect(lines[0]!.err!.stack).toContain('db down');
  });

  it('drops lines below the configured level', () => {
    const { logger, lines } = capture('warn');
    logger.log('quiet');
    logger.debug('quieter');
    logger.warn('loud');
    expect(lines.map((line) => line.msg)).toEqual(['loud']);
  });

  it('backs Nest Logger instances once installed', () => {
    const { logger, lines } = capture();
    Logger.overrideLogger(logger);
    new Logger('Mail').warn('could not send');
    Logger.overrideLogger(false);
    expect(lines.some((line) => line.context === 'Mail' && line.msg === 'could not send')).toBe(true);
  });
});

describe('request context', () => {
  it('adopts the trace ID of an incoming W3C traceparent', () => {
    const traceId = '4bf92f3577b34da6a3ce929d0e0e4736';
    expect(resolveTraceId(`00-${traceId}-00f067aa0ba902b7-01`)).toBe(traceId);
  });

  it('generates a trace ID when none (or an invalid one) arrives', () => {
    expect(resolveTraceId(undefined)).toMatch(/^[\da-f]{32}$/);
    expect(resolveTraceId(`00-${'0'.repeat(32)}-00f067aa0ba902b7-01`)).toMatch(/^[\da-f]{32}$/);
    expect(resolveTraceId('garbage')).toMatch(/^[\da-f]{32}$/);
  });

  it('is scoped to the run', () => {
    runWithLogContext({ traceId: 't' }, () => expect(currentLogContext()?.traceId).toBe('t'));
    expect(currentLogContext()).toBeUndefined();
  });
});

describe('safeUrlPath', () => {
  it('drops query strings, which can carry signed media grants', () => {
    expect(safeUrlPath('/media/stream?a=1&s=2&e=3&sig=secret')).toBe('/media/stream');
  });

  it('masks DRM grant tokens in the path', () => {
    expect(safeUrlPath('/media/drm/eyJhbGciOi.secret/video/seg-1.m4s')).toBe('/media/drm/[redacted]/video/seg-1.m4s');
  });
});
