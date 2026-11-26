'use client';

import { useTranslations } from 'next-intl';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { GlobalLoader } from './page-loader';

/** Wait this long before showing the loader, so quick page changes don't flash it. */
const SHOW_AFTER_MS = 200;
/**
 * Never leave the loader up if a navigation is cancelled or fails. Generous, because
 * a page's first visit in development can take a while to compile.
 */
const GIVE_UP_AFTER_MS = 60_000;
const NAVIGATE_EVENT = 'obgyn:navigate';

/**
 * Call just before a navigation started from code (router.push / replace), which the
 * loader can't see as a link click: e.g. menu items, redirects after saving.
 */
export function showNavigationLoader(href?: string): void {
  if (href) {
    // Going to the page we're already on: nothing loads, so no loader.
    const target = new URL(href, window.location.href);
    const strip = (path: string) => path.replace(/^\/(en|hi)(?=\/|$)/, '') || '/';
    if (strip(target.pathname) === strip(window.location.pathname) && target.search === window.location.search) return;
  }
  window.dispatchEvent(new Event(NAVIGATE_EVENT));
}

/** True when a click on this anchor will make the App Router load another page. */
function isPageNavigation(anchor: HTMLAnchorElement, event: MouseEvent): boolean {
  if (
    event.defaultPrevented ||
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey
  ) {
    return false;
  }
  if ((anchor.target && anchor.target !== '_self') || anchor.hasAttribute('download')) return false;
  const url = new URL(anchor.href, window.location.href);
  if (url.origin !== window.location.origin) return false;
  // Same page with only a different #hash: nothing loads.
  return url.pathname !== window.location.pathname || url.search !== window.location.search;
}

/** Fired (asynchronously) whenever the App Router writes the address bar. */
const URL_COMMIT_EVENT = 'obgyn:url-commit';
let historyPatched = false;

/**
 * The App Router updates the address bar (history.pushState / replaceState) when a
 * navigation commits. Watching those calls tells us a navigation finished, including
 * ones that only change the query string (filters, pagination), without subscribing to
 * `useSearchParams()`. Each call is passed through unchanged.
 */
function watchHistoryWrites(): void {
  if (historyPatched || typeof window === 'undefined') return;
  historyPatched = true;
  for (const method of ['pushState', 'replaceState'] as const) {
    const original = window.history[method];
    window.history[method] = function (this: History, ...args: Parameters<History['pushState']>) {
      const result = original.apply(this, args);
      // Not synchronously: the router writes history from inside a React commit.
      setTimeout(() => window.dispatchEvent(new Event(URL_COMMIT_EVENT)), 0);
      return result;
    };
  }
}

/** While a navigation is pending, re-render this often (see "nudge" below). */
const NUDGE_EVERY_MS = 50;

/**
 * Shows the global loader in the middle of the screen while a page loads. It starts on
 * internal link clicks, GET form submits (admin search, filters, rows per page) and
 * back/forward, and hides once the new page has been committed.
 *
 * Two measured fixes for slow page changes (production build, see docs/11-PERFORMANCE.md):
 *  - No `useSearchParams()`: in the root layout (inside the Suspense boundary it requires),
 *    that subscription held many navigations until this component re-rendered for another
 *    reason. Address-bar writes are watched instead.
 *  - "Nudge": on some routes (e.g. instructor dashboard → courses, admin users → review)
 *    the App Router's transition stays pending after the page's data and code have
 *    arrived (~110 ms) until any React update happens; then it commits at once. Without
 *    an update it never commits (an upstream React/Next.js issue). Previously the update
 *    came from this loader's own 200 ms "show" timer, so those pages took ~280 ms. A
 *    cheap re-render of this component every 50 ms while a navigation is pending lets
 *    them commit as soon as they are ready (~110–150 ms). Nothing visible changes.
 */
export function NavigationLoader() {
  const t = useTranslations('Common');
  const pathname = usePathname();
  const renderedPath = useRef(pathname);
  const [visible, setVisible] = useState(false);
  const [, setNudge] = useState(0);
  const showTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const giveUpTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const nudgeTimer = useRef<ReturnType<typeof setInterval>>(undefined);

  useEffect(() => {
    const hide = () => {
      clearTimeout(showTimer.current);
      clearTimeout(giveUpTimer.current);
      clearInterval(nudgeTimer.current);
      setVisible(false);
    };
    const start = () => {
      clearTimeout(showTimer.current);
      clearTimeout(giveUpTimer.current);
      clearInterval(nudgeTimer.current);
      showTimer.current = setTimeout(() => setVisible(true), SHOW_AFTER_MS);
      giveUpTimer.current = setTimeout(hide, GIVE_UP_AFTER_MS);
      nudgeTimer.current = setInterval(() => setNudge((n) => n + 1), NUDGE_EVERY_MS);
    };
    // Back/forward: the address bar has already changed. Only a different page needs the
    // loader; a query-only step (e.g. a previous filter) comes from the router cache.
    const onPopState = () => {
      if (window.location.pathname !== renderedPath.current) start();
    };
    const onClick = (event: MouseEvent) => {
      const anchor = (event.target as Element | null)?.closest?.('a[href]');
      if (anchor instanceof HTMLAnchorElement && isPageNavigation(anchor, event)) start();
    };
    const onSubmit = (event: SubmitEvent) => {
      const form = event.target;
      if (form instanceof HTMLFormElement && form.method.toLowerCase() === 'get' && !event.defaultPrevented) {
        start();
      }
    };
    watchHistoryWrites();
    document.addEventListener('click', onClick, true);
    document.addEventListener('submit', onSubmit);
    window.addEventListener('popstate', onPopState);
    window.addEventListener(NAVIGATE_EVENT, start);
    // The router wrote the address bar: the navigation committed.
    window.addEventListener(URL_COMMIT_EVENT, hide);
    return () => {
      window.removeEventListener(NAVIGATE_EVENT, start);
      window.removeEventListener(URL_COMMIT_EVENT, hide);
      document.removeEventListener('click', onClick, true);
      document.removeEventListener('submit', onSubmit);
      window.removeEventListener('popstate', onPopState);
      clearTimeout(showTimer.current);
      clearTimeout(giveUpTimer.current);
      clearInterval(nudgeTimer.current);
    };
  }, []);

  // A new page is on screen (or the route loading screen is).
  useEffect(() => {
    renderedPath.current = pathname;
    clearTimeout(showTimer.current);
    clearTimeout(giveUpTimer.current);
    clearInterval(nudgeTimer.current);
    setVisible(false);
  }, [pathname]);

  return visible ? <GlobalLoader label={t('loading')} source="nav" /> : null;
}
