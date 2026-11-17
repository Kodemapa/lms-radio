import { getTranslations } from 'next-intl/server';

/**
 * Shown inside the admin layout while a page renders on the server. Next.js does not pass
 * `params` to loading files, so the locale comes from next-intl's request locale.
 */
export default async function AdminLoading() {
  const t = await getTranslations('Common');
  return (
    <div role="status" aria-busy="true" className="flex flex-col gap-6">
      <span className="sr-only">{t('loading')}</span>
      <div className="h-9 w-2/5 animate-pulse rounded-lg bg-muted" />
      <div className="h-5 w-3/5 animate-pulse rounded-lg bg-muted" />
      <div className="h-36 animate-pulse rounded-2xl bg-muted" />
      <div className="h-64 animate-pulse rounded-2xl bg-muted" />
    </div>
  );
}
