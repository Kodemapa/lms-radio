/**
 * Browser fetch against our BFF. On 401 it rotates the session once via
 * /api/auth/refresh and retries.
 */
export async function bffFetch(input: string, init?: RequestInit): Promise<Response> {
  const res = await fetch(input, { ...init, credentials: 'same-origin', cache: 'no-store' });
  if (res.status !== 401) return res;
  const refreshed = await fetch('/api/auth/refresh', { method: 'POST', credentials: 'same-origin' });
  if (!refreshed.ok) return res;
  return fetch(input, { ...init, credentials: 'same-origin', cache: 'no-store' });
}
