import { afterEach, describe, expect, it, vi } from 'vitest';
import { POST } from './route';

const valid = { name: 'Asha', email: 'asha@example.com', subject: 'Access', message: 'I cannot open lesson three.', consent: true };
const send = (body: unknown, query = '') =>
  POST(new Request(`http://localhost/api/contact${query}`, { method: 'POST', body: JSON.stringify(body), headers: { 'x-forwarded-for': '203.0.113.7' } }));

afterEach(() => vi.unstubAllGlobals());

describe('public contact route', () => {
  it('rejects invalid input without calling the API', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    expect((await send({ ...valid, consent: false })).status).toBe(400);
    expect((await send({ ...valid, website: 'spam' })).status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('forwards valid messages anonymously with the client IP and a safe locale', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);
    expect((await send(valid, '?locale=xx')).status).toBe(204);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('http://localhost:4000/content/contact?locale=en');
    const headers = init.headers as Headers;
    expect(headers.get('authorization')).toBeNull();
    expect(headers.get('x-forwarded-for')).toBe('203.0.113.7');
  });

  it('passes the API rate limit through', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{"message":"Too Many Requests"}', { status: 429 })));
    expect((await send(valid, '?locale=hi')).status).toBe(429);
  });
});
