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

// ---- Session events shared between this user's tabs ---------------------------------
//
// 'write'    data changed: client caches must be cleared (lib/client-cache.ts)
// 'verified' the API accepted this session at `at` (any authenticated call succeeded), so
//            the session watch can skip its own check (components/layout/session-watch.tsx)
// 'ended'    the session is over: every tab goes to sign-in now, not at its next check
// 'scope'    this browser is now signed in as `scope` (user ID + role): a tab still showing
//            a different account reloads, so it never mixes two accounts' data

export type SessionEvent =
  /** `background`: frequent writes that change no page (progress heartbeats, read marks). */
  | { type: 'write'; background?: boolean }
  | { type: 'verified'; at: number }
  | { type: 'ended' }
  | { type: 'scope'; scope: string };
type Listener = (event: SessionEvent) => void;

const SESSION_CHANNEL = 'elms-session';
const listeners = new Set<Listener>();
let sessionChannel: BroadcastChannel | null | undefined;
let lastVerifiedAt = 0;
/** Who this tab's page and caches belong to ("<userId>:<role>"), or null when signed out. */
let sessionScope: string | null = null;

function channel(): BroadcastChannel | null {
  if (sessionChannel !== undefined) return sessionChannel;
  sessionChannel = typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel(SESSION_CHANNEL);
  if (sessionChannel) sessionChannel.onmessage = (message: MessageEvent<SessionEvent>) => deliver(message.data, false);
  return sessionChannel;
}

function deliver(event: SessionEvent, broadcast: boolean): void {
  if (event.type === 'verified') lastVerifiedAt = Math.max(lastVerifiedAt, event.at);
  if (event.type === 'ended') sessionScope = null;
  if (event.type === 'scope' && !broadcast && event.scope !== sessionScope) {
    // Another tab signed in as someone else (cookies are shared by all tabs): this tab's
    // page belongs to the previous account. Reload so it shows the current one.
    sessionScope = event.scope;
    for (const listener of listeners) listener({ type: 'write' });
    window.location.reload();
    return;
  }
  for (const listener of listeners) listener(event);
  if (broadcast) channel()?.postMessage(event);
}

/**
 * Declare who this tab is signed in as (called by the signed-in layouts' user menu). A
 * change from one known user or role to another clears every client cache first, so nothing
 * cached for the previous account or role can be shown, and in-flight answers are discarded.
 * Initial sign-in has no private cache to clear: private reads fail closed until this scope
 * is established.
 */
export function setSessionScope(userId: string | null, role: string | null): void {
  const next = userId ? `${userId}:${role ?? ''}` : null;
  if (next === sessionScope) return;
  const changedAccount = sessionScope !== null;
  sessionScope = next;
  if (changedAccount) deliver({ type: 'write' }, false);
  if (next) deliver({ type: 'scope', scope: next }, true);
}

/** The current scope, used to key client cache entries. */
export function currentSessionScope(): string | null {
  return sessionScope;
}

/** Listen to session events from this tab and the user's other tabs. */
export function onSessionEvent(listener: Listener): () => void {
  channel();
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** When the API last accepted this session (from any tab), in ms since epoch. */
export function sessionLastVerifiedAt(): number {
  channel();
  return lastVerifiedAt;
}

/** Announce that data changed (clears client caches everywhere; see RouterCacheSync). */
export function announceWrite(background = false): void {
  deliver({ type: 'write', background }, true);
}

/** Writes that happen often and change no page the user would revisit. */
const BACKGROUND_WRITE = /\/(progress|read|read-all)$|\/api\/proxy\/auth\//;

/** Announce that the session ended (sends the user's other tabs to sign-in). */
export function announceSessionEnded(): void {
  deliver({ type: 'ended' }, true);
}

/**
 * The session was just proved valid, e.g. a signed-in page was server-rendered a moment
 * ago (the render used the session). Local only: other tabs learn from real API calls.
 */
export function noteSessionVerifiedLocally(): void {
  lastVerifiedAt = Math.max(lastVerifiedAt, Date.now());
}

/** Successful authenticated responses are throttled into one 'verified' broadcast per 5 s. */
let lastAnnounced = 0;
function noteVerified(): void {
  const now = Date.now();
  lastVerifiedAt = Math.max(lastVerifiedAt, now);
  if (now - lastAnnounced < 5_000) return;
  lastAnnounced = now;
  deliver({ type: 'verified', at: now }, true);
}

const READ_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

function goToSignIn(): void {
  announceSessionEnded();
  const login = new URL('/en/login', window.location.origin);
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
  // Any write may change what a cached GET would return: clear caches (all tabs). Done for
  // failed writes too, since a write can fail after changing something.
  if (!READ_METHODS.has((init?.method ?? 'GET').toUpperCase())) announceWrite(BACKGROUND_WRITE.test(input.split('?')[0]!));
  // The API's session guard accepted this session on this very call (it says so with
  // X-Session-Verified; public endpoints and local proxy answers do not), so it is valid now.
  if (res.headers.get('x-session-verified') === '1') noteVerified();
  return res;
}
