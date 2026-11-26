import { type LoggerService } from '@nestjs/common';
import { currentLogContext, currentSpanId } from './request-context';

export type LogLevel = 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'verbose';
export type LogFormat = 'json' | 'pretty';

const SEVERITY: Record<LogLevel, number> = { fatal: 0, error: 1, warn: 2, info: 3, debug: 4, verbose: 5 };
const COLOURS: Record<LogLevel, string> = {
  fatal: '\x1b[35m',
  error: '\x1b[31m',
  warn: '\x1b[33m',
  info: '\x1b[32m',
  debug: '\x1b[36m',
  verbose: '\x1b[90m',
};

export interface LogRecord {
  time: string;
  level: LogLevel;
  context?: string;
  msg: string;
  traceId?: string;
  spanId?: string;
  userId?: string;
  err?: { name: string; message: string; stack?: string };
  [field: string]: unknown;
}

/**
 * The API's logger (replaces Nest's default via `app.useLogger`). Every line carries the
 * request's trace ID and user ID, so one request can be followed through the logs and
 * matched to its trace. `json` writes one object per line for log shippers (Loki, ELK,
 * CloudWatch); `pretty` is for a developer's terminal.
 *
 * Works with every existing `new Logger('Context').warn(...)` call unchanged.
 */
export class AppLogger implements LoggerService {
  private threshold: number;

  constructor(
    level: LogLevel = 'info',
    private readonly format: LogFormat = 'json',
    private readonly write: (line: string, level: LogLevel) => void = defaultWrite,
  ) {
    this.threshold = SEVERITY[level];
  }

  log(message: unknown, ...params: unknown[]): void {
    this.emit('info', message, params);
  }
  error(message: unknown, ...params: unknown[]): void {
    this.emit('error', message, params);
  }
  warn(message: unknown, ...params: unknown[]): void {
    this.emit('warn', message, params);
  }
  debug(message: unknown, ...params: unknown[]): void {
    this.emit('debug', message, params);
  }
  verbose(message: unknown, ...params: unknown[]): void {
    this.emit('verbose', message, params);
  }
  fatal(message: unknown, ...params: unknown[]): void {
    this.emit('fatal', message, params);
  }

  /** Structured record with extra fields, e.g. the HTTP access log. */
  record(level: LogLevel, context: string, msg: string, fields: Record<string, unknown>): void {
    if (SEVERITY[level] > this.threshold) return;
    this.output({ ...this.base(level, context, msg), ...fields });
  }

  setLogLevels(levels: string[]): void {
    const known = levels.map((level) => (level === 'log' ? 'info' : level)).filter((l): l is LogLevel => l in SEVERITY);
    if (known.length > 0) this.threshold = Math.max(...known.map((level) => SEVERITY[level]));
  }

  private emit(level: LogLevel, message: unknown, params: unknown[]): void {
    if (SEVERITY[level] > this.threshold) return;
    const rest = [...params];
    // Nest passes the context name last.
    const context = rest.length > 0 && typeof rest[rest.length - 1] === 'string' ? (rest.pop() as string) : undefined;
    const record = this.base(level, context, '');
    if (message instanceof Error) {
      record.msg = message.message;
      record.err = serializeError(message);
    } else if (typeof message === 'string') {
      record.msg = message;
    } else {
      record.msg = '';
      record.data = message;
    }
    for (const param of rest) {
      if (param instanceof Error) record.err = serializeError(param);
      // Nest's `logger.error(message, stack, context)`.
      else if (typeof param === 'string' && level === 'error' && !record.err) record.err = { name: 'Error', message: record.msg, stack: param };
      else if (param !== undefined) record.data = param;
    }
    this.output(record);
  }

  private base(level: LogLevel, context: string | undefined, msg: string): LogRecord {
    const ctx = currentLogContext();
    const record: LogRecord = { time: new Date().toISOString(), level, msg };
    if (context) record.context = context;
    if (ctx?.traceId) record.traceId = ctx.traceId;
    const spanId = currentSpanId();
    if (spanId) record.spanId = spanId;
    if (ctx?.userId) record.userId = ctx.userId;
    return record;
  }

  private output(record: LogRecord): void {
    this.write(this.format === 'json' ? safeStringify(record) : pretty(record), record.level);
  }
}

function serializeError(error: Error): NonNullable<LogRecord['err']> {
  return { name: error.name, message: error.message, stack: error.stack };
}

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return JSON.stringify({ ...(value as object), data: '[unserialisable]' });
  }
}

function pretty(record: LogRecord): string {
  const { time, level, context, msg, traceId, spanId: _spanId, userId, err, ...fields } = record;
  const colour = COLOURS[level];
  const parts = [
    `\x1b[90m${time}\x1b[0m`,
    `${colour}${level.toUpperCase().padEnd(5)}\x1b[0m`,
    context ? `\x1b[33m[${context}]\x1b[0m` : '',
    msg,
    Object.keys(fields).length > 0 ? `\x1b[90m${safeStringify(fields)}\x1b[0m` : '',
    // Full ID, so the `x-trace-id` copied from the browser can be searched for as-is.
    traceId ? `\x1b[90mtrace=${traceId}\x1b[0m` : '',
    userId ? `\x1b[90muser=${userId.slice(0, 8)}\x1b[0m` : '',
  ];
  const line = parts.filter(Boolean).join(' ');
  return err?.stack ? `${line}\n${err.stack}` : line;
}

function defaultWrite(line: string, level: LogLevel): void {
  (SEVERITY[level] <= SEVERITY.warn ? process.stderr : process.stdout).write(`${line}\n`);
}
