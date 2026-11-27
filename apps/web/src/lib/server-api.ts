import { ACCESS_TOKEN_COOKIE } from '@obgyn/types';
import { getLocale } from 'next-intl/server';
import { cookies, headers as requestHeaders } from 'next/headers';
import { redirect } from 'next/navigation';
import { type z } from 'zod';
import { routing } from '@/i18n/routing';
import { API_URL } from './env';
import { childTraceparent, logApiFailure, newTraceId, traceIdFrom } from './trace';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly body: unknown,
  ) {
    super(`API responded ${status}`);
  }
}

/**
 * A signed-in call came back 401: the session ended mid-page (signed out,
 * blocked, deleted or expired). Send the user to sign in instead of crashing.
 */
async function redirectToLogin(): Promise<never> {
  const locale = await getLocale().catch(() => routing.defaultLocale);
  redirect(`/${locale}/login`);
}

/** Server-side GET against the API, validated with a shared zod schema. */
export async function apiGet<T>(
  path: string,
  schema: z.ZodType<T, z.ZodTypeDef, unknown>,
  {
    auth = false,
    trace = auth,
    onUnauthorized = 'login',
  }: {
    auth?: boolean;
    /** Continue the middleware trace for dynamic public renders without making static pages dynamic. */
    trace?: boolean;
    /**
     * What a 401 on an `auth` call does: 'login' (default) redirects to the sign-in page;
     * 'throw' raises ApiError(401) for callers that handle it themselves, e.g. public
     * pages that simply show a signed-out view.
     */
    onUnauthorized?: 'login' | 'throw';
  } = {},
): Promise<T> {
  const headers: Record<string, string> = { accept: 'application/json' };
  // A new trace unless this page request already has one (set by middleware, below).
  let traceId = newTraceId();
  // Only opt into request headers for authenticated or already-dynamic public renders;
  // static public pages keep their build-time rendering and don't need a request trace.
  if (trace) {
    try {
      const incoming = await requestHeaders();
      if (auth) {
        // Signed-in calls pass the visitor's IP on, so rate limits apply per visitor rather
        // than counting every server-rendered request against the web server's IP.
        const forwardedFor = incoming.get('x-forwarded-for');
        if (forwardedFor) headers['x-forwarded-for'] = forwardedFor;
      }
      traceId = traceIdFrom(incoming.get('traceparent')) ?? traceId;
    } catch {
      // Outside a request (build time): nothing to forward.
    }
  }
  headers.traceparent = childTraceparent(traceId);
  if (auth) {
    const token = (await cookies()).get(ACCESS_TOKEN_COOKIE)?.value;
    if (!token) {
      if (onUnauthorized === 'login') await redirectToLogin();
      throw new ApiError(401, null);
    }
    headers.authorization = `Bearer ${token}`;
  }
  const started = Date.now();
  const res = await fetchWithRetry(`${API_URL}${path}`, { headers, cache: 'no-store' }, { path, traceId, started });
  if (auth && res.status === 401 && onUnauthorized === 'login') await redirectToLogin();
  if (!res.ok) {
    // 404s are routine (unknown slug → not-found page); log only real failures.
    if (res.status >= 500 || res.status === 429) {
      logApiFailure({ method: 'GET', path, status: res.status, traceId: res.headers.get('x-trace-id') ?? traceId, durationMs: Date.now() - started });
    }
    throw new ApiError(res.status, await res.json().catch(() => null));
  }
  return schema.parse(await res.json());
}

/** Waits before each retry of a GET whose connection failed. */
const RETRY_DELAYS_MS = [150, 600, 1500];

/**
 * In development, how long a page render waits for the API to come back before giving up.
 * `nest start --watch` recompiles the whole API with tsc on every save, so a restart takes
 * several seconds, far longer than the production retry schedule above. Waiting means the
 * page renders with real data instead of empty sections and a 503 in the log.
 */
const DEV_WAIT_FOR_API_MS = 30_000;
const DEV_POLL_MS = 500;

/**
 * Readable reason a fetch never got an HTTP answer. Node reports a refused `localhost`
 * connection as an AggregateError (one ECONNREFUSED per address tried: ::1 and 127.0.0.1),
 * which stringifies to just "AggregateError".
 */
function describeFetchFailure(error: unknown): string {
  const cause = (error as { cause?: unknown } | null)?.cause ?? error;
  if (cause instanceof AggregateError) {
    const parts = (cause.errors as { code?: string; address?: string; port?: number; message?: string }[]).map((e) =>
      e.code ? `${e.code} ${e.address ?? ''}:${e.port ?? ''}` : String(e.message ?? e),
    );
    return `${[...new Set(parts)].join(', ')} (is the API running?)`;
  }
  return String(cause);
}

/**
 * fetch() for GETs, retried when the request never got an HTTP answer ("fetch failed":
 * connection refused, reset or timed out). That happens while the API restarts (every file
 * save under `nest start --watch` in development, a deploy in production) or when an idle
 * keep-alive connection is closed just as it is reused. GETs are safe to repeat. In
 * development the render waits up to DEV_WAIT_FOR_API_MS for the API to come back. If the API
 * stays unreachable, a normal ApiError(503) is thrown (and logged with the trace ID) instead
 * of a raw TypeError, so pages fail the same way they do for any other API error.
 */
async function fetchWithRetry(url: string, init: RequestInit, ctx: { path: string; traceId: string; started: number }): Promise<Response> {
  const isDev = process.env.NODE_ENV !== 'production';
  for (let attempt = 0; ; attempt++) {
    try {
      return await fetch(url, init);
    } catch (error) {
      const elapsed = Date.now() - ctx.started;
      let delay: number | undefined;
      if (isDev) delay = elapsed + DEV_POLL_MS < DEV_WAIT_FOR_API_MS ? DEV_POLL_MS : undefined;
      else delay = RETRY_DELAYS_MS[attempt];
      if (!(error instanceof TypeError) || delay === undefined) {
        const cause = describeFetchFailure(error);
        logApiFailure({ method: 'GET', path: ctx.path, status: 503, traceId: ctx.traceId, durationMs: elapsed, cause });
        throw new ApiError(503, { message: 'API unreachable', cause });
      }
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}

export async function isSignedIn(): Promise<boolean> {
  return (await cookies()).has(ACCESS_TOKEN_COOKIE);
}
