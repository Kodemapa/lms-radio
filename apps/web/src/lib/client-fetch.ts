/** Outcome of asking the BFF to refresh the session. */
type RefreshOutcome = 'ok' | 'ended' | 'retry';

/**
 * One refresh at a time per tab: when the access token expires, every open request
 * (session check, notification bell, the page's own calls) gets a 401 at once. Without
 * this they would all refresh together and all but one would lose the rotation race.
 */
let refreshing: Promise<RefreshOutcome> | null = null;

function refreshSession(): Promise<RefreshOutcome> {
  refreshing ??= fetch('/api/auth/refresh', { method: 'POST', credentials: 'same-origin' })
    .then((res): RefreshOutcome => {
      if (res.ok) return 'ok';
      // 401: the session is really over. 409 (another tab refreshed first) or 503 (API
      // briefly unreachable): the session is fine, the request just needs another try.
      return res.status === 401 ? 'ended' : 'retry';
    })
    .catch((): RefreshOutcome => 'retry')
    .finally(() => {
      // Let requests that arrive a moment later reuse the result, then allow a new refresh.
      setTimeout(() => {
        refreshing = null;
      }, 1000);
    });
  return refreshing;
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function goToSignIn(): void {
  const locale = window.location.pathname.split('/')[1] === 'hi' ? 'hi' : 'en';
  const login = new URL(`/${locale}/login`, window.location.origin);
  login.searchParams.set('next', `${window.location.pathname}${window.location.search}`);
  // Tells the sign-in page to explain why (blocked, role changed, signed out elsewhere).
  login.searchParams.set('reason', 'session-ended');
  window.location.replace(login);
}

/**
 * Browser fetch against our BFF. On 401 it refreshes the session (shared with any other
 * request doing the same) and retries. Only a refresh that says the session has ended
 * sends the user to sign in; races and network blips are retried instead.
 */
export async function bffFetch(input: string, init?: RequestInit): Promise<Response> {
  const send = () => fetch(input, { ...init, credentials: 'same-origin', cache: 'no-store' });
  let res = await send();
  for (let attempt = 0; res.status === 401 && attempt < 3; attempt++) {
    const outcome = await refreshSession();
    if (outcome === 'ended') {
      goToSignIn();
      return res;
    }
    // 'ok': cookies are fresh. 'retry': another refresh won; its cookies are arriving.
    if (outcome === 'retry') await wait(300 * (attempt + 1));
    res = await send();
  }
  return res;
}
