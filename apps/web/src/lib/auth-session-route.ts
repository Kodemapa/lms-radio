import { TokenPairSchema } from '@obgyn/types';
import { NextResponse } from 'next/server';
import { type ZodType } from 'zod';
import { badRequest, forwardHeaders, logBffCall, passThrough, upstreamUnavailable, withDiagnostics } from './bff';
import { setAuthCookies } from './auth-cookies';
import { API_URL } from './env';
import { logWeb } from './trace';

/** Reads the identity claims from a freshly issued access token for client cache scoping. */
export function identityFromToken(token: string): { userId: string | null; role: string | null } {
  try {
    const payload = JSON.parse(Buffer.from(token.split('.')[1] ?? '', 'base64url').toString('utf8')) as {
      sub?: unknown;
      role?: unknown;
    };
    return {
      userId: typeof payload.sub === 'string' && payload.sub.length > 0 ? payload.sub : null,
      role: typeof payload.role === 'string' ? payload.role : null,
    };
  } catch {
    return { userId: null, role: null };
  }
}

export async function createAuthSession<T extends { deviceId: string }>(
  req: Request,
  path: string,
  schema: ZodType<T>,
): Promise<NextResponse> {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest();

  const started = performance.now();
  try {
    const upstream = await postWhenReachable(`${API_URL}/auth/${path}`, {
      method: 'POST',
      headers: forwardHeaders(req),
      body: JSON.stringify(parsed.data),
    });
    logBffCall('POST', `auth/${path}`, started, upstream);
    if (!upstream.ok) return passThrough(upstream);

    const tokens = TokenPairSchema.safeParse(await upstream.json());
    if (!tokens.success) {
      logWeb('error', 'BFF', `POST /auth/${path}: unexpected token response from the API`);
      return upstreamUnavailable();
    }

    // Identity scopes the in-memory cache and picks the correct dashboard without another API call.
    const res = NextResponse.json({ ok: true, ...identityFromToken(tokens.data.accessToken) }, { status: upstream.status });
    setAuthCookies(res, tokens.data, parsed.data.deviceId);
    return withDiagnostics(res, upstream);
  } catch (error) {
    // Previously silent: sign-in showed "Something went wrong" with nothing in the logs.
    logWeb('error', 'BFF', `POST /auth/${path} 503: API unreachable (${connectionErrorCode(error) ?? String(error)})`);
    logBffCall('POST', `auth/${path}`, started, null, 503);
    return upstreamUnavailable();
  }
}

/** Waits before each retry while the API refuses connections (≈2.6 s in total). */
const REFUSED_RETRY_DELAYS_MS = [300, 800, 1500];

/**
 * POST, retried only while the API refuses the connection (ECONNREFUSED): the API process
 * is restarting (deploy, PM2 restart) and the request was never delivered, so repeating it
 * can't sign in twice or spend a one-time code twice. Any other failure is not retried.
 */
async function postWhenReachable(url: string, init: RequestInit): Promise<Response> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fetch(url, init);
    } catch (error) {
      if (connectionErrorCode(error) !== 'ECONNREFUSED' || attempt >= REFUSED_RETRY_DELAYS_MS.length) throw error;
      await new Promise((resolve) => setTimeout(resolve, REFUSED_RETRY_DELAYS_MS[attempt]));
    }
  }
}

/** undici puts the socket error under `cause` ("TypeError: fetch failed"). */
export function connectionErrorCode(error: unknown): string | undefined {
  const cause = (error as { cause?: { code?: unknown; errors?: { code?: unknown }[] } } | null)?.cause;
  const code = cause?.code ?? cause?.errors?.[0]?.code; // AggregateError when IPv4 and IPv6 both fail
  return typeof code === 'string' ? code : undefined;
}
