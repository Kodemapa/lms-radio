'use client';

import { Button } from '@obgyn/ui';
import { useTranslations } from 'next-intl';
import { useEffect } from 'react';

/**
 * Shown when a page fails to render, e.g. the API stayed unreachable after apiGet's
 * retries (an API restart in development, a deploy in production). Before this, such a
 * failure surfaced as Next.js's raw "TypeError: fetch failed". "Try again" re-renders the
 * page from the server without a full reload.
 */
export default function PageError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useTranslations('Common');

  useEffect(() => {
    // The digest matches the server log line for this failure (production hides details).
    console.error('Page failed to render', error.digest ?? error.message);
  }, [error]);

  return (
    <main id="main" className="mx-auto flex min-h-[60dvh] max-w-lg flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="text-2xl font-bold">{t('pageErrorTitle')}</h1>
      <p className="text-muted-foreground">{t('genericError')}</p>
      <Button onClick={() => reset()}>{t('tryAgain')}</Button>
    </main>
  );
}
