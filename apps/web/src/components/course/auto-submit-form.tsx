'use client';

import { useRouter } from 'next/navigation';
import { type ComponentProps, useEffect, useRef, useState, useTransition } from 'react';

/** Typing pauses this long before the results update. */
const TYPING_DELAY_MS = 350;
/** While results load, re-render this often (see below). */
const NUDGE_EVERY_MS = 50;

/**
 * Catalogue search + filters that update the results in place:
 *  - choosing a filter or sort updates at once;
 *  - typing in the search box updates shortly after the user pauses, and Enter updates now;
 *  - empty fields ("Any", a cleared search) are left out of the URL, and the page number
 *    is dropped, so a new search starts on page 1.
 * It navigates within the app (no full page load), so the search box keeps focus while
 * typing. `data-pending` is set while new results load (the bar shows a quiet indicator).
 * Without JavaScript it is a plain GET form: Enter submits it.
 *
 * Nudge: some App Router transitions stay pending after their data has arrived until any
 * React update happens (the same upstream issue NavigationLoader works around), so this
 * form re-renders itself every 50 ms while a search is loading.
 */
export function AutoSubmitForm({ action, className, ...props }: ComponentProps<'form'> & { action: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [, setNudge] = useState(0);
  const typingTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(typingTimer.current), []);
  useEffect(() => {
    if (!pending) return;
    const timer = setInterval(() => setNudge((n) => n + 1), NUDGE_EVERY_MS);
    return () => clearInterval(timer);
  }, [pending]);

  const update = (form: HTMLFormElement, mode: 'push' | 'replace') => {
    clearTimeout(typingTimer.current);
    const params = new URLSearchParams();
    for (const [name, value] of new FormData(form)) {
      if (typeof value !== 'string') continue;
      const clean = value.trim();
      if (name && clean) params.set(name, clean);
    }
    const query = params.toString();
    const url = query ? `${action}?${query}` : action;
    if (url === `${window.location.pathname}${window.location.search}`) return;
    startTransition(() => router[mode](url, { scroll: false }));
  };

  return (
    <form
      {...props}
      action={action}
      method="get"
      data-pending={pending ? 'true' : undefined}
      aria-busy={pending}
      className={`group ${className ?? ''}`}
      onChange={(event) => {
        const target = event.target;
        const form = event.currentTarget;
        if (target instanceof HTMLInputElement && (target.type === 'search' || target.type === 'text')) {
          // One history entry per search, not per keystroke.
          clearTimeout(typingTimer.current);
          typingTimer.current = setTimeout(() => update(form, 'replace'), TYPING_DELAY_MS);
          return;
        }
        update(form, 'push');
      }}
      onSubmit={(event) => {
        event.preventDefault();
        update(event.currentTarget, 'push');
      }}
    />
  );
}
