'use client';

import { useTranslations } from 'next-intl';
import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { GlobalLoader } from './page-loader';

/** Wait this long before showing the loader, so quick page changes don't flash it. */
const SHOW_AFTER_MS = 200;
/** Never leave the loader up if a navigation is cancelled or fails. */
const GIVE_UP_AFTER_MS = 15_000;

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

/**
 * Shows the global loader in the middle of the screen while a page loads. It starts on
 * internal link clicks, GET form submits (admin search, filters, rows per page) and
 * back/forward, and hides once the URL has changed.
 */
export function NavigationLoader() {
  const t = useTranslations('Common');
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [visible, setVisible] = useState(false);
  const showTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const giveUpTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    const start = () => {
      clearTimeout(showTimer.current);
      clearTimeout(giveUpTimer.current);
      showTimer.current = setTimeout(() => setVisible(true), SHOW_AFTER_MS);
      giveUpTimer.current = setTimeout(() => {
        clearTimeout(showTimer.current);
        setVisible(false);
      }, GIVE_UP_AFTER_MS);
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
    document.addEventListener('click', onClick, true);
    document.addEventListener('submit', onSubmit);
    window.addEventListener('popstate', start);
    return () => {
      document.removeEventListener('click', onClick, true);
      document.removeEventListener('submit', onSubmit);
      window.removeEventListener('popstate', start);
      clearTimeout(showTimer.current);
      clearTimeout(giveUpTimer.current);
    };
  }, []);

  // The URL changed: the new page is on screen (or its own loading screen is).
  useEffect(() => {
    clearTimeout(showTimer.current);
    clearTimeout(giveUpTimer.current);
    setVisible(false);
  }, [pathname, searchParams]);

  return visible ? <GlobalLoader label={t('loading')} source="nav" /> : null;
}
