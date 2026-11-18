'use client';

import { useEffect } from 'react';
import { bffFetch } from '@/lib/client-fetch';

/** How often an open, visible tab checks that its session is still valid. */
const CHECK_EVERY_MS = 15_000;

/**
 * Signs this tab out as soon as the account's session ends elsewhere: an admin blocked
 * or deleted the user, changed their role (which revokes all sessions so the new role
 * applies), or the user signed out in another tab. Checks every 15 s while the tab is
 * visible and immediately when the user comes back to it.
 *
 * `bffFetch` does the work: on 401 it tries a token refresh; when the session was revoked
 * that fails too, the auth cookies are cleared and the tab does a full page load to the
 * sign-in page (with a "you were signed out" note), so no cached signed-in page survives.
 */
export function useSessionWatch() {
  useEffect(() => {
    let stopped = false;
    let running = false;

    const check = async () => {
      if (stopped || running || document.visibilityState !== 'visible') return;
      running = true;
      try {
        const res = await bffFetch('/api/proxy/users/me');
        if (res.status === 401) stopped = true; // bffFetch is already taking the tab to sign-in
      } catch {
        // Offline or API restarting: try again on the next tick.
      } finally {
        running = false;
      }
    };

    const timer = setInterval(check, CHECK_EVERY_MS);
    document.addEventListener('visibilitychange', check);
    window.addEventListener('focus', check);
    return () => {
      stopped = true;
      clearInterval(timer);
      document.removeEventListener('visibilitychange', check);
      window.removeEventListener('focus', check);
    };
  }, []);
}
