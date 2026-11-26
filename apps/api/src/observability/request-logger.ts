import { type NextFunction, type Request, type Response } from 'express';
import { type AuthUser } from '../auth/auth-user';
import { type AppLogger } from './app-logger';
import { safeUrlPath } from './redact';
import { resolveTraceId, runWithLogContext } from './request-context';

/** Probes hit these every few seconds; logging them would drown everything else. */
const QUIET_PATHS = /^\/health(\/|$)/;

/**
 * First Express middleware: gives the request its trace ID (returned as `X-Trace-Id` so a
 * user or the web app can quote it in a bug report), runs the rest of the request inside
 * that log context, and writes one access-log line when the response finishes.
 *
 * Logged: method, path (query string dropped, media tokens masked), route template,
 * status, duration, user ID, cache result. Not logged: bodies, headers, IPs, tokens.
 */
export function requestLogger(logger: AppLogger, { logRequests }: { logRequests: boolean }) {
  return (req: Request & { user?: AuthUser }, res: Response, next: NextFunction): void => {
    const traceId = resolveTraceId(req.get('traceparent'));
    res.setHeader('X-Trace-Id', traceId);
    const started = process.hrtime.bigint();
    const path = safeUrlPath(req.originalUrl);

    if (logRequests && !QUIET_PATHS.test(path)) {
      let logged = false;
      const done = () => {
        if (logged) return;
        logged = true;
        const durationMs = Number((process.hrtime.bigint() - started) / 1000n) / 1000;
        const status = res.writableFinished ? res.statusCode : 499; // 499: client went away
        const level = status >= 500 ? 'error' : status >= 400 ? 'warn' : 'info';
        const route = (req.route as { path?: string } | undefined)?.path;
        logger.record(level, 'HTTP', `${req.method} ${path} ${status} ${durationMs.toFixed(1)}ms`, {
          http: {
            method: req.method,
            path,
            ...(route ? { route: String(route) } : {}),
            status,
            durationMs,
            ...(res.getHeader('X-Cache') ? { cache: res.getHeader('X-Cache') } : {}),
          },
          ...(req.user ? { userId: req.user.userId, role: req.user.role } : {}),
          traceId,
        });
      };
      res.once('finish', done);
      res.once('close', done);
    }

    runWithLogContext({ traceId }, next);
  };
}
