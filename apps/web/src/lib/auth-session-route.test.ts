import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { connectionErrorCode, createAuthSession } from './auth-session-route';

const schema = z.object({ email: z.string(), password: z.string(), deviceId: z.string() });
const body = { email: 'a@example.com', password: 'secret-1', deviceId: '6f1c2a3b-0000-4000-8000-000000000001' };
const request = () =>
  new Request('http://web.test/api/auth/login', { method: 'POST', body: JSON.stringify(body), headers: { 'content-type': 'application/json' } });

const fetchFailed = (code: string) => Object.assign(new TypeError('fetch failed'), { cause: { code } });
/** A token whose payload carries sub + role, like the API's access token. */
const token = `x.${Buffer.from(JSON.stringify({ sub: 'user-1', role: 'LEARNER' })).toString('base64url')}.y`;
const tokens = () =>
  new Response(JSON.stringify({ accessToken: token, refreshToken: 'r', accessTokenExpiresIn: 900, refreshTokenExpiresAt: new Date(Date.now() + 86_400_000).toISOString() }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });

describe('createAuthSession', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('retries while the API refuses connections (restarting), then signs in', async () => {
    vi.useFakeTimers();
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const fetchMock = vi.fn().mockRejectedValueOnce(fetchFailed('ECONNREFUSED')).mockRejectedValueOnce(fetchFailed('ECONNREFUSED')).mockResolvedValueOnce(tokens());
    vi.stubGlobal('fetch', fetchMock);

    const pending = createAuthSession(request(), 'login', schema);
    await vi.runAllTimersAsync();
    const res = await pending;

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, userId: 'user-1', role: 'LEARNER' });
  });

  it('does not retry other connection failures (the request may have been delivered)', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const fetchMock = vi.fn().mockRejectedValue(fetchFailed('ECONNRESET'));
    vi.stubGlobal('fetch', fetchMock);

    const res = await createAuthSession(request(), 'login', schema);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ message: 'Service unavailable' });
  });

  it('gives up with 503 when the API stays down', async () => {
    vi.useFakeTimers();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const fetchMock = vi.fn().mockRejectedValue(fetchFailed('ECONNREFUSED'));
    vi.stubGlobal('fetch', fetchMock);

    const pending = createAuthSession(request(), 'login', schema);
    await vi.runAllTimersAsync();
    const res = await pending;

    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(res.status).toBe(503);
  });
});

describe('connectionErrorCode', () => {
  it('reads undici causes, including AggregateError for IPv4+IPv6', () => {
    expect(connectionErrorCode(fetchFailed('ECONNREFUSED'))).toBe('ECONNREFUSED');
    expect(connectionErrorCode(Object.assign(new TypeError('fetch failed'), { cause: { errors: [{ code: 'ECONNREFUSED' }] } }))).toBe('ECONNREFUSED');
    expect(connectionErrorCode(new Error('x'))).toBeUndefined();
  });
});
