/**
 * Browser fetch against our BFF. On 401 it rotates the session once via
 * /api/auth/refresh and retries.
 */
export async function bffFetch(input: string, init?: RequestInit): Promise<Response> {
  const res = await fetch(input, { ...init, credentials: 'same-origin', cache: 'no-store' });
  if (res.status !== 401) return res;
  const refreshed = await fetch('/api/auth/refresh', { method: 'POST', credentials: 'same-origin' });
  if (!refreshed.ok) {
    const locale = window.location.pathname.split('/')[1] === 'hi' ? 'hi' : 'en';
    const login = new URL(`/${locale}/login`, window.location.origin);
    login.searchParams.set('next', `${window.location.pathname}${window.location.search}`);
    // Tells the sign-in page to explain why (blocked, role changed, signed out elsewhere).
    login.searchParams.set('reason', 'session-ended');
    window.location.replace(login);
    return res;
  }
  return fetch(input, { ...init, credentials: 'same-origin', cache: 'no-store' });
}
