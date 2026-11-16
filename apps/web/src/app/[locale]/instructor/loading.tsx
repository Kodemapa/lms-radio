import { Skeleton } from '@obgyn/ui';
import { getTranslations } from 'next-intl/server';

/**
 * Shown inside the instructor layout while a page renders on the server, so a
 * sidebar click gives instant feedback instead of appearing to do nothing.
 */
export default async function InstructorLoading() {
  const t = await getTranslations('Common');
  return (
    <div role="status" aria-busy="true" className="flex flex-col gap-6">
      <span className="sr-only">{t('loading')}</span>
      <Skeleton className="h-9 w-64" />
      <Skeleton className="h-5 w-96 max-w-full" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton key={i} className="h-24 rounded-2xl" />
        ))}
      </div>
      <Skeleton className="h-64 rounded-2xl" />
    </div>
  );
}
