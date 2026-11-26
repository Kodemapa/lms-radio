import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type Reply = { status?: number; body?: unknown; headers?: Record<string, string> };

/** A fake BFF: records calls; replies per URL (a function lets a test hold a reply). */
function installFetch(reply: (url: string, init?: RequestInit) => Reply | Promise<Reply>) {
  const calls: Array<{ url: string; method: string }> = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url, method: init?.method ?? 'GET' });
      const r = await reply(url, init);
      return new Response(r.status === 204 ? null : JSON.stringify(r.body ?? {}), {
        status: r.status ?? 200,
        headers: { 'content-type': 'application/json', ...(r.headers ?? {}) },
      });
    }),
  );
  return calls;
}

async function load() {
  vi.resetModules();
  const cache = await import('./client-cache');
  const fetchMod = await import('./client-fetch');
  return { ...cache, ...fetchMod };
}

describe('client cache', () => {
  beforeEach(() => {
    vi.useRealTimers();
    vi.stubGlobal('BroadcastChannel', undefined);
  });
  afterEach(() => vi.unstubAllGlobals());

  it('shares one request between identical GETs in flight', async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    const calls = installFetch(async () => {
      await gate;
      return { body: { unreadCount: 3 } };
    });
    const { cachedJson, setSessionScope } = await load();
    setSessionScope('alice', 'LEARNER');
    const a = cachedJson('/api/proxy/notifications/unread-count');
    const b = cachedJson('/api/proxy/notifications/unread-count');
    release();
    expect(await a).toEqual({ unreadCount: 3 });
    expect(await b).toEqual({ unreadCount: 3 });
    expect(calls).toHaveLength(1);
  });

  it('reuses a fresh answer and fetches again once it is older than maxAgeMs', async () => {
    const calls = installFetch(() => ({ body: { n: 1 } }));
    const { cachedJson, setSessionScope } = await load();
    setSessionScope('alice', 'FACULTY');
    const now = vi.spyOn(Date, 'now').mockReturnValue(1_000);
    await cachedJson('/api/proxy/instructor/courses', { maxAgeMs: 15_000 });
    now.mockReturnValue(15_999);
    await cachedJson('/api/proxy/instructor/courses', { maxAgeMs: 15_000 });
    expect(calls).toHaveLength(1);
    now.mockReturnValue(16_001);
    await cachedJson('/api/proxy/instructor/courses', { maxAgeMs: 15_000 });
    expect(calls).toHaveLength(2);
    now.mockRestore();
  });

  it('is cleared by any write made through bffFetch', async () => {
    const calls = installFetch((_url, init) => (init?.method === 'POST' ? { status: 204 } : { body: { unreadCount: 5 } }));
    const { cachedJson, bffFetch, clientCacheSize, setSessionScope } = await load();
    setSessionScope('alice', 'LEARNER');
    await cachedJson('/api/proxy/notifications/unread-count');
    expect(clientCacheSize()).toBe(1);
    await bffFetch('/api/proxy/notifications/read-all', { method: 'POST' });
    expect(clientCacheSize()).toBe(0);
    await cachedJson('/api/proxy/notifications/unread-count');
    expect(calls.filter((c) => c.method === 'GET')).toHaveLength(2);
  });

  it('does not keep an answer that was in flight when a write happened', async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    installFetch(async (_url, init) => {
      if (init?.method === 'POST') return { status: 204 };
      await gate;
      return { body: { stale: true } };
    });
    const { cachedJson, bffFetch, clientCacheSize, setSessionScope } = await load();
    setSessionScope('alice', 'ADMIN');
    const read = cachedJson('/api/proxy/admin/categories');
    await bffFetch('/api/proxy/admin/categories/order', { method: 'POST' });
    release();
    await read;
    expect(clientCacheSize()).toBe(0);
  });

  it('never caches signed media URLs, auth calls or errors', async () => {
    const calls = installFetch((url) => (url.includes('broken') ? { status: 500, body: { message: 'x' } } : { body: { url: 'signed' } }));
    const { cachedJson, ClientFetchError, setSessionScope } = await load();
    setSessionScope('alice', 'ADMIN');
    const media = '/api/proxy/media/6f1c2a3b-0000-4000-8000-000000000001/url';
    await cachedJson(media);
    await cachedJson(media);
    await cachedJson('/api/proxy/auth/session').catch(() => undefined);
    await cachedJson('/api/proxy/auth/session').catch(() => undefined);
    expect(calls.filter((c) => c.url === media)).toHaveLength(2);
    expect(calls.filter((c) => c.url.endsWith('auth/session'))).toHaveLength(2);
    await expect(cachedJson('/api/proxy/admin/broken')).rejects.toBeInstanceOf(ClientFetchError);
    await expect(cachedJson('/api/proxy/admin/broken')).rejects.toBeInstanceOf(ClientFetchError);
    expect(calls.filter((c) => c.url.endsWith('broken'))).toHaveLength(2);
  });

  it('gives every caller its own copy', async () => {
    installFetch(() => ({ body: { items: [1, 2] } }));
    const { cachedJson, setSessionScope } = await load();
    setSessionScope('alice', 'ADMIN');
    const first = await cachedJson<{ items: number[] }>('/api/proxy/admin/faqs');
    first.items.push(99);
    const second = await cachedJson<{ items: number[] }>('/api/proxy/admin/faqs');
    expect(second.items).toEqual([1, 2]);
  });

  it('does not cache private data until a user scope is established', async () => {
    const calls = installFetch(() => ({ body: { user: 'alice' } }));
    const { cachedJson, clientCacheSize } = await load();
    await cachedJson('/api/proxy/users/me');
    await cachedJson('/api/proxy/users/me');
    expect(calls).toHaveLength(2);
    expect(clientCacheSize()).toBe(0);
  });

  it('isolates private entries by user and role', async () => {
    const calls = installFetch((url) => ({ body: { url, calls: undefined } }));
    const { cachedJson, setSessionScope } = await load();
    setSessionScope('alice', 'LEARNER');
    await cachedJson('/api/proxy/users/me/learning');
    setSessionScope('bob', 'LEARNER');
    await cachedJson('/api/proxy/users/me/learning');
    setSessionScope('bob', 'ADMIN');
    await cachedJson('/api/proxy/users/me/learning');
    expect(calls).toHaveLength(3);
  });

  it('does not let a response started for a previous account resolve into the new session', async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    installFetch(async () => {
      await gate;
      return { body: { user: 'alice' } };
    });
    const { cachedJson, setSessionScope, ClientSessionChangedError } = await load();
    setSessionScope('alice', 'LEARNER');
    const oldRead = cachedJson('/api/proxy/users/me/learning');
    setSessionScope('bob', 'LEARNER');
    release();
    await expect(oldRead).rejects.toBeInstanceOf(ClientSessionChangedError);
  });

  it('allows caching only for explicitly public learner catalogue reads without a scope', async () => {
    const calls = installFetch(() => ({ body: { items: [] } }));
    const { cachedJson } = await load();
    await cachedJson('/api/proxy/courses?page=1');
    await cachedJson('/api/proxy/courses?page=1');
    expect(calls).toHaveLength(1);
  });
});

describe('session verification', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('counts only responses where the API says it checked the session', async () => {
    installFetch((url) =>
      url.includes('reviews') ? { body: [] } : { body: {}, headers: { 'x-session-verified': '1' } },
    );
    const { bffFetch, sessionLastVerifiedAt } = await load();
    await bffFetch('/api/proxy/courses/x/reviews');
    expect(sessionLastVerifiedAt()).toBe(0);
    const before = Date.now();
    await bffFetch('/api/proxy/users/me');
    expect(sessionLastVerifiedAt()).toBeGreaterThanOrEqual(before);
  });
});
