import { AdminDrmListSchema, AdminDrmQuerySchema, DRM_PACKAGE_STATUSES } from '@obgyn/types';
import { getFormatter, getTranslations, setRequestLocale } from 'next-intl/server';
import { DrmRetryButton } from '@/components/admin/drm-retry-button';
import { Link } from '@/i18n/navigation';
import { requireAdmin } from '@/lib/admin-server';
import { apiGet } from '@/lib/server-api';

type SearchParams = Record<string, string | string[] | undefined>;

const BADGE: Record<string, string> = {
  READY: 'bg-green-100 text-green-800',
  FAILED: 'bg-red-100 text-red-800',
  QUEUED: 'bg-muted text-muted-foreground',
  PACKAGING: 'bg-amber-100 text-amber-900',
};

export default async function AdminMediaPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireAdmin(locale, '/admin/media');
  const [t, format, raw] = await Promise.all([getTranslations('Admin.media'), getFormatter(), searchParams]);
  const query = AdminDrmQuerySchema.catch(AdminDrmQuerySchema.parse({})).parse({
    status: typeof raw.status === 'string' && raw.status ? raw.status : undefined,
    page: typeof raw.page === 'string' ? raw.page : undefined,
  });
  const api = new URLSearchParams({ page: String(query.page) });
  if (query.status) api.set('status', query.status);
  const result = await apiGet(`/admin/media/drm?${api}`, AdminDrmListSchema, { auth: true });
  const href = (status: string | undefined, page = 1) =>
    `/admin/media?${new URLSearchParams({ ...(status ? { status } : {}), page: String(page) })}`;
  const total = Object.values(result.counts).reduce((sum, count) => sum + (count ?? 0), 0);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold md:text-3xl">{t('title')}</h1>
        <p className="text-muted-foreground">{t('intro')}</p>
      </div>
      {!result.enabled ? (
        <p role="status" className="rounded-xl bg-amber-50 p-4 text-sm text-amber-950 dark:bg-amber-950/30 dark:text-amber-100">
          {t('disabled')}
        </p>
      ) : null}

      <nav aria-label={t('filter')} className="flex flex-wrap gap-2">
        {[undefined, ...DRM_PACKAGE_STATUSES].map((status) => (
          <Link
            key={status ?? 'ALL'}
            href={href(status)}
            aria-current={query.status === status ? 'page' : undefined}
            className={`rounded-full px-4 py-2 text-sm font-medium ${
              query.status === status ? 'bg-secondary text-secondary-foreground' : 'border border-border bg-card hover:bg-muted'
            }`}
          >
            {status ? t(`statuses.${status}`) : t('all')} ({status ? (result.counts[status] ?? 0) : total})
          </Link>
        ))}
      </nav>

      <div className="overflow-x-auto rounded-2xl border border-border bg-card">
        <table className="w-full min-w-[760px] text-left text-sm">
          <caption className="sr-only">{t('title')}</caption>
          <thead className="border-b border-border bg-muted/60 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th scope="col" className="px-4 py-3">{t('table.video')}</th>
              <th scope="col" className="px-4 py-3">{t('table.usedIn')}</th>
              <th scope="col" className="px-4 py-3">{t('table.status')}</th>
              <th scope="col" className="px-4 py-3">{t('table.updated')}</th>
              <th scope="col" className="px-4 py-3"><span className="sr-only">{t('table.actions')}</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {result.items.length === 0 ? (
              <tr><td colSpan={5} className="p-10 text-center text-muted-foreground">{t('empty')}</td></tr>
            ) : (
              result.items.map((item) => (
                <tr key={item.assetId} className="align-top">
                  <td className="px-4 py-3">
                    <p className="font-medium">{item.originalName ?? t('untitled')}</p>
                    <p className="text-xs text-muted-foreground">{item.ownerName ?? '—'}</p>
                  </td>
                  <td className="px-4 py-3">
                    {item.lessons.length ? (
                      <ul className="flex flex-col gap-0.5">
                        {item.lessons.map((lesson) => (
                          <li key={lesson.id}>{lesson.courseTitle} · {lesson.title}</li>
                        ))}
                      </ul>
                    ) : <span className="text-muted-foreground">{t('unused')}</span>}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${BADGE[item.status]}`}>{t(`statuses.${item.status}`)}</span>
                    <p className="mt-1 text-xs text-muted-foreground">{t('attempts', { count: item.attempts })}</p>
                    {item.error ? <p className="mt-1 max-w-xs break-words text-xs text-destructive">{item.error}</p> : null}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    {format.dateTime(new Date(item.updatedAt), { dateStyle: 'medium', timeStyle: 'short' })}
                  </td>
                  <td className="px-4 py-3">
                    {result.enabled && (item.status === 'FAILED' || item.status === 'READY') ? (
                      <DrmRetryButton assetId={item.assetId} ready={item.status === 'READY'} />
                    ) : null}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {result.totalPages > 1 ? (
        <nav aria-label={t('paging')} className="flex items-center justify-between gap-3">
          {query.page > 1 ? <Link href={href(query.status, query.page - 1)} className="rounded-md border border-border px-3 py-2 text-sm">{t('previous')}</Link> : <span />}
          <span className="text-sm">{query.page} / {result.totalPages}</span>
          {query.page < result.totalPages ? <Link href={href(query.status, query.page + 1)} className="rounded-md border border-border px-3 py-2 text-sm">{t('next')}</Link> : <span />}
        </nav>
      ) : null}
    </div>
  );
}
