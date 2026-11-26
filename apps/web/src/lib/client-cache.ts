/**
 * Client-side cache for GET calls through the BFF (`/api/proxy/*`).
 *
 * - Memory only, per tab. Never localStorage/sessionStorage/IndexedDB: on a shared computer
 *   nothing of one user's data may survive for the next person.
 * - De-duplication: identical GETs in flight at the same time share one request.
 * - Freshness: an entry is reused for `maxAgeMs`, then fetched again.
 * - Invalidation: any write through bffFetch (POST/PUT/PATCH/DELETE) clears the whole cache,
 *   in this tab and in the user's other tabs (BroadcastChannel, see lib/client-fetch.ts), so
 *   a change made anywhere is never shown stale. Sign-out and known account changes clear it
 *   as well; private reads are not cached until the signed-in account is known.
 * - Never cached: signed media URLs/playback (short-lived grants), auth calls and exports.
 */
import { announceWrite, bffFetch, currentSessionScope, onSessionEvent } from './client-fetch';

const NEVER_CACHE = /\/api\/proxy\/(media\/|auth\/|.*\/export)/;
const PUBLIC_CACHEABLE =
  /^\/api\/proxy\/(?:categories|courses(?:\/[a-z0-9-]+)?|instructors(?:\/[a-z0-9-]+)?)$/;

interface Entry {
  at: number;
  data?: unknown;
  pending?: Promise<unknown>;
}

const entries = new Map<string, Entry>();
/** Bumped on every invalidation, so a response that started before it is never stored. */
let generation = 0;
let subscribed = false;

/** Writes (from any tab) and the end of the session clear the cache. */
function subscribe(): void {
  if (subscribed) return;
  subscribed = true;
  onSessionEvent((event) => {
    if (event.type === 'write' || event.type === 'ended') clearLocal();
  });
}

function clearLocal(): void {
  generation++;
  entries.clear();
}

/** Forget everything (this tab and the user's other tabs). */
export function invalidateClientCache(): void {
  announceWrite();
}

export class ClientFetchError extends Error {
  constructor(
    readonly status: number,
    readonly body: unknown,
  ) {
    super(`Request failed with ${status}`);
  }
}

export class ClientSessionChangedError extends Error {
  constructor() {
    super('The active account changed while this request was in flight');
  }
}

/**
 * GET `url` as JSON, reusing a recent or in-flight response. Errors are not cached.
 * Each caller gets its own copy, so a screen that edits what it received can't change
 * what the next caller sees.
 */
export function cachedJson<T>(url: string, { maxAgeMs = 15_000 }: { maxAgeMs?: number } = {}): Promise<T> {
  subscribe();
  if (NEVER_CACHE.test(url)) return fetchJson<T>(url);
  const isPublic = PUBLIC_CACHEABLE.test(url.split(/[?#]/, 1)[0]!);
  const scope = isPublic ? null : currentSessionScope();
  // Private reads fail closed until the signed-in layout has identified this account.
  if (!isPublic && !scope) return fetchJson<T>(url);
  // Private entries belong to one account and role; public entries are explicitly allow-listed.
  const key = `${scope ?? 'public'}|${url}`;
  const now = Date.now();
  const entry = entries.get(key);
  if (entry?.pending) return (entry.pending as Promise<T>).then(copy);
  if (entry && 'data' in entry && now - entry.at < maxAgeMs) return Promise.resolve(copy(entry.data as T));

  const startedIn = generation;
  // Only touch the entry if it is still ours (a newer request may have replaced it).
  const settle = (next?: Entry) => {
    if (entries.get(key)?.pending !== pending) return;
    if (next) entries.set(key, next);
    else entries.delete(key);
  };
  const pending: Promise<T> = fetchJson<T>(url).then(
    (data) => {
      if (scope && currentSessionScope() !== scope) {
        settle();
        throw new ClientSessionChangedError();
      }
      // Invalidated while in flight: the answer may predate the change, so don't keep it.
      settle(generation === startedIn ? { at: Date.now(), data } : undefined);
      return data;
    },
    (error: unknown) => {
      settle();
      throw error;
    },
  );
  entries.set(key, { at: now, pending });
  return pending.then(copy);
}

const copy = <T,>(value: T): T => structuredClone(value);

async function fetchJson<T>(url: string): Promise<T> {
  const res = await bffFetch(url);
  if (!res.ok) throw new ClientFetchError(res.status, await res.json().catch(() => null));
  return (await res.json()) as T;
}

/** For tests. */
export function clientCacheSize(): number {
  return entries.size;
}
