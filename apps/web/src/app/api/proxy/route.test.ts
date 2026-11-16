import { describe, expect, it, vi } from 'vitest';

vi.mock('next/headers', () => ({
  cookies: async () => ({ get: () => ({ value: 'token' }) }),
}));

const { GET, POST } = await import('./[...path]/route');

const call = (handler: typeof GET, method: string, path: string[]) =>
  handler(new Request(`http://localhost/api/proxy/${path.join('/')}`, { method }), {
    params: Promise.resolve({ path }),
  });

describe('BFF proxy allow-list', () => {
  it.each([
    ['GET', ['admin', '..', 'users']],
    ['GET', ['auth', 'refresh']],
    ['GET', ['health']],
    ['POST', ['users', 'me']],
    ['GET', ['instructor', 'courses%2F..']],
  ])('rejects %s %j', async (method, path) => {
    const res = await call(method === 'GET' ? GET : POST, method, path);
    expect(res.status).toBe(404);
  });

  it('forwards allowed paths with the bearer token', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{"ok":true}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const res = await call(GET, 'GET', ['instructor', 'courses']);
    expect(res.status).toBe(200);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('http://localhost:4000/instructor/courses');
    expect((init.headers as Headers).get('authorization')).toBe('Bearer token');
    vi.unstubAllGlobals();
  });
});
