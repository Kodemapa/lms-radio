import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { bffFetch } from './client-fetch';

type Route = (url: string) => Response;

function stubBrowser(route: Route) {
  const replace = vi.fn();
  vi.stubGlobal('window', {
    location: { pathname: '/en/instructor', search: '', origin: 'https://lms.example', replace },
  });
  const fetchMock = vi.fn(async (input: string) => route(input));
  vi.stubGlobal('fetch', fetchMock);
  return { fetchMock, replace };
}

const json = (status: number, body: unknown = {}) => new Response(JSON.stringify(body), { status });

describe('bffFetch', () => {
  beforeEach(() => vi.useFakeTimers({ shouldAdvanceTime: true }));
  afterEach(async () => {
    // Let the shared refresh result expire, so each test starts fresh.
    await vi.advanceTimersByTimeAsync(1100);
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('shares one refresh between requests that all hit an expired token', async () => {
    let refreshed = false;
    const { fetchMock } = stubBrowser((url) => {
      if (url === '/api/auth/refresh') {
        refreshed = true;
        return json(200);
      }
      return refreshed ? json(200) : json(401);
    });
    const results = await Promise.all([bffFetch('/api/proxy/a'), bffFetch('/api/proxy/b'), bffFetch('/api/proxy/c')]);
    expect(results.map((r) => r.status)).toEqual([200, 200, 200]);
    expect(fetchMock.mock.calls.filter(([url]) => url === '/api/auth/refresh')).toHaveLength(1);
  });

  it('does not sign out when the refresh lost a race with another tab', async () => {
    let calls = 0;
    const { replace } = stubBrowser((url) => {
      if (url === '/api/auth/refresh') return json(409, { code: 'REFRESH_RACE' });
      calls++;
      // The other tab's new cookies arrive: the retried request succeeds.
      return calls > 1 ? json(200) : json(401);
    });
    const res = await bffFetch('/api/proxy/users/me');
    expect(res.status).toBe(200);
    expect(replace).not.toHaveBeenCalled();
  });

  it('signs out only when the session has really ended', async () => {
    const { replace } = stubBrowser((url) => (url === '/api/auth/refresh' ? json(401) : json(401)));
    await bffFetch('/api/proxy/users/me');
    expect(replace).toHaveBeenCalledTimes(1);
    expect(String(replace.mock.calls[0]![0])).toContain('/en/login');
  });
});
