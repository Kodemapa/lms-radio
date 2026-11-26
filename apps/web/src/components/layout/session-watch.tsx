'use client';

import { useEffect } from 'react';
import { bffFetch, noteSessionVerifiedLocally, onSessionEvent, sessionLastVerifiedAt } from '@/lib/client-fetch';

/** A visible tab's session is confirmed valid at least this often. */
const MAX_UNVERIFIED_MS = 15_000;
/** Local tick (no network): decides whether a check is due. */
const TICK_MS = 2_500;
/** Check once the last confirmation is this old, so the gap never exceeds MAX_UNVERIFIED_MS. */
const CHECK_WHEN_OLDER_THAN_MS = MAX_UNVERIFIED_MS - TICK_MS;
const PROFILE_URL = '/api/proxy/users/me';
/** Switches to PROFILE_URL (for this page load) if the API doesn't have the session endpoint. */
let sessionCheckUrl = '/api/proxy/auth/session';

/**
 * Signs this tab out as soon as the account's session ends elsewhere: an admin blocked
 * or deleted the user, changed their role (which revokes all sessions so the new role
 * applies), or the user signed out in another tab.
 *
 * Guarantee (unchanged): while a tab is visible, its session is confirmed valid at least
 * every 15 s, and again as soon as the user returns to the tab. What changed is how:
 *  - The check is `GET /auth/session` (204/401): the API's session guard and nothing else,
 *    instead of loading the whole profile.
 *  - It is skipped when the session was already confirmed within the last 15 s by any
 *    authenticated call (the page's own requests, the notification bell) in this tab or
 *    in another tab of this browser (shared over BroadcastChannel). So several open tabs
 *    make one check per 15 s between them, not one each.
 *  - When one tab finds the session ended, the other tabs are told at once and go to
 *    sign-in immediately instead of at their next check.
 *
 * `bffFetch` does the sign-out: on 401 it tries a token refresh; when the session was
 * revoked that fails too, the auth cookies are cleared and the tab does a full page load
 * to the sign-in page (with a "you were signed out" note), so no signed-in page survives.
 */
export function useSessionWatch() {
  useEffect(() => {
    // This signed-in page was just rendered on the server with the session: valid now.
    noteSessionVerifiedLocally();
    let stopped = false;
    let running = false;

    const check = async (force: boolean) => {
      if (stopped || running || document.visibilityState !== 'visible') return;
      // A recent authenticated call already proved the session valid.
      if (!force && Date.now() - sessionLastVerifiedAt() < CHECK_WHEN_OLDER_THAN_MS) return;
      running = true;
      try {
        let res = await bffFetch(sessionCheckUrl);
        // An API older than this web build has no /auth/session (the web app deploys on its
        // own): fall back to the profile, which the same session guard protects.
        if (res.status === 404 && sessionCheckUrl !== PROFILE_URL) {
          sessionCheckUrl = PROFILE_URL;
          res = await bffFetch(sessionCheckUrl);
        }
        if (res.status === 401) stopped = true; // bffFetch is already taking the tab to sign-in
      } catch {
        // Offline or API restarting: try again on the next tick.
      } finally {
        running = false;
      }
    };

    const onTick = () => void check(false);
    // Coming back to the tab: check now (unless another tab confirmed it a moment ago).
    const onReturn = () => {
      if (Date.now() - sessionLastVerifiedAt() > 2_000) void check(true);
    };
    const unsubscribe = onSessionEvent((event) => {
      if (event.type === 'ended') void check(true);
    });

    const timer = setInterval(onTick, TICK_MS);
    document.addEventListener('visibilitychange', onReturn);
    window.addEventListener('focus', onReturn);
    return () => {
      stopped = true;
      clearInterval(timer);
      unsubscribe();
      document.removeEventListener('visibilitychange', onReturn);
      window.removeEventListener('focus', onReturn);
    };
  }, []);
}
