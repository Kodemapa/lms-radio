'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { onSessionEvent } from '@/lib/client-fetch';

/**
 * Keeps the client-side page cache (Next.js router cache, `staleTimes` in next.config.ts)
 * correct. Pages visited in the last 30 s are shown again from memory without asking the
 * server (My Learning, Wishlist, Profile, the catalogue, course pages, dashboards).
 * That is only safe if a change clears them, so:
 *  - a save in this tab clears the page cache and refreshes the current page (once per
 *    burst of saves);
 *  - a save in another tab of this browser does the same here when the user comes back;
 *  - frequent background writes (lesson progress, read marks) don't refresh anything.
 * `router.refresh()` both empties the router cache and re-renders the current page.
 * Signing in as someone else changes the scope (lib/client-fetch.ts), which counts as a
 * write; signing out is a full page load, which starts with an empty cache anyway.
 */
export function RouterCacheSync() {
  const router = useRouter();

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let staleFromOtherTab = false;
    const refresh = () => {
      clearTimeout(timer);
      timer = setTimeout(() => router.refresh(), 150);
    };
    const off = onSessionEvent((event) => {
      if (event.type !== 'write' || event.background) return;
      if (document.visibilityState === 'visible') refresh();
      else staleFromOtherTab = true;
    });
    const onVisible = () => {
      if (document.visibilityState === 'visible' && staleFromOtherTab) {
        staleFromOtherTab = false;
        refresh();
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      off();
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [router]);

  return null;
}
