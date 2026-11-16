import { Skeleton } from '@obgyn/ui';
import { getTranslations } from 'next-intl/server';

/** Shown beside the account menu while a page renders on the server. */
export default async function AccountLoading() {
  const t = await getTranslations('Common');
  return (
    <div role="status" aria-busy="true" className="flex flex-col gap-6">
      <span className="sr-only">{t('loading')}</span>
      <Skeleton className="h-9 w-56" />
      <div className="grid gap-4 sm:grid-cols-2">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-40 rounded-2xl" />
        ))}
      </div>
    </div>
  );
}
