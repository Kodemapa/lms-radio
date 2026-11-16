import { Skeleton } from '@obgyn/ui';
import { getTranslations } from 'next-intl/server';

/**
 * Shown under the site header while a public page (course, catalogue, …)
 * renders on the server, so a click such as "Back to course" responds at once.
 */
export default async function SiteLoading() {
  const t = await getTranslations('Common');
  return (
    <div role="status" aria-busy="true" className="container flex flex-col gap-6 py-10">
      <span className="sr-only">{t('loading')}</span>
      <Skeleton className="h-10 w-2/3 max-w-xl" />
      <Skeleton className="h-5 w-full max-w-2xl" />
      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <Skeleton className="h-72 rounded-2xl" />
        <Skeleton className="h-72 rounded-2xl" />
      </div>
    </div>
  );
}
