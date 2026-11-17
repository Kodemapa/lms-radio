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

  const USER = '6f1c2a3b-0000-4000-8000-000000000003';

  it.each([
    ['PATCH', ['admin', 'users', USER, 'role']],
    ['DELETE', ['admin', 'users', USER]],
    ['PATCH', ['admin', 'categories', USER]],
    ['DELETE', ['admin', 'categories', USER]],
    ['PUT', ['admin', 'categories', 'order']],
    ['PATCH', ['admin', 'application-fields', USER]],
    ['PUT', ['admin', 'application-fields', 'order']],
    ['GET', ['admin', 'content', 'pages']],
    ['POST', ['admin', 'content', 'pages']],
    ['GET', ['admin', 'content', 'faqs']],
    ['POST', ['admin', 'content', 'faqs']],
    ['GET', ['admin', 'content', 'settings']],
    ['PATCH', ['admin', 'content', 'pages', USER]],
    ['DELETE', ['admin', 'content', 'faqs', USER]],
    ['PUT', ['admin', 'content', 'settings']],
    ['GET', ['admin', 'content', 'contact']],
    ['PATCH', ['admin', 'content', 'contact', USER]],
    ['DELETE', ['admin', 'content', 'contact', USER]],
    ['GET', ['admin', 'content', 'messages']],
    ['PUT', ['admin', 'content', 'messages']],
  ])('forwards admin edits %s %j', async (method, path) => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);
    const res = await call(GET, method, path);
    expect(res.status).toBe(204);
    expect(fetchMock.mock.calls[0]![0]).toBe(`http://localhost:4000/${path.join('/')}`);
    vi.unstubAllGlobals();
  });

  it.each([
    ['PATCH', ['admin', 'users', USER]],
    ['DELETE', ['admin', 'users', USER, 'role']],
    ['DELETE', ['admin', 'audit']],
    ['PUT', ['admin', 'users', USER]],
    ['PATCH', ['admin', 'content', 'settings']],
    ['DELETE', ['admin', 'stats']],
    ['PUT', ['admin', 'content', 'contact']],
    ['DELETE', ['admin', 'content', 'messages']],
  ])('rejects other admin %s %j', async (method, path) => {
    const res = await call(GET, method, path);
    expect(res.status).toBe(404);
  });
});
