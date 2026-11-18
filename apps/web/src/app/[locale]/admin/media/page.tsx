import { ADMIN_DEFAULT_PAGE_SIZE, AdminDrmListSchema, AdminDrmQuerySchema, DRM_PACKAGE_STATUSES } from '@obgyn/types';
import { AdminPager } from '@obgyn/ui';
import { getFormatter, getTranslations, setRequestLocale } from 'next-intl/server';
import { DrmRetryButton } from '@/components/admin/drm-retry-button';
import { Link } from '@/i18n/navigation';
import { requireAdmin } from '@/lib/admin-server';
import { apiGet } from '@/lib/server-api';
import { pageWindow, PAGE_SIZE_OPTIONS, readPageSize, withQuery } from '@/lib/admin-paging';

type SearchParams = Record<string, string | string[] | undefined>;

const BADGE: Record<string, string> = {
  READY: 'bg-success/15 text-success',
  FAILED: 'bg-destructive/10 text-destructive',
  QUEUED: 'bg-muted text-muted-foreground',
  PACKAGING: 'bg-accent-light text-accent-deep',
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
  const [t, tAdmin, format, raw] = await Promise.all([
    getTranslations('Admin.media'),
    getTranslations('Admin'),
    getFormatter(),
    searchParams,
  ]);
  const query = AdminDrmQuerySchema.catch(AdminDrmQuerySchema.parse({})).parse({
    status: typeof raw.status === 'string' && raw.status ? raw.status : undefined,
    page: typeof raw.page === 'string' ? raw.page : undefined,
    pageSize: readPageSize(raw.pageSize, ADMIN_DEFAULT_PAGE_SIZE),
  });
  const result = await apiGet(
    withQuery('/admin/media/drm', { status: query.status, page: query.page, pageSize: query.pageSize }),
    AdminDrmListSchema,
    { auth: true },
  );
  const href = (status: string | undefined, page = 1) =>
    withQuery('/admin/media', { status, page, pageSize: query.pageSize });
  const pageInfo = pageWindow(result.total, query.page, query.pageSize);
  const total = Object.values(result.counts).reduce((sum, count) => sum + (count ?? 0), 0);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold md:text-3xl">{t('title')}</h1>
        <p className="text-muted-foreground">{t('intro')}</p>
      </div>
      {!result.enabled ? (
        <p role="status" className="rounded-xl bg-accent-light p-4 text-sm text-accent-deep">
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

      <div className="max-h-[min(70vh,48rem)] overflow-auto rounded-2xl border border-border bg-card">
        <table className="w-full min-w-[760px] text-left text-sm">
          <caption className="sr-only">{t('title')}</caption>
          <thead className="sticky top-0 z-10 border-b border-border bg-muted text-xs uppercase tracking-wide text-muted-foreground">
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

      <AdminPager
        ariaLabel={tAdmin('pages')}
        summary={tAdmin('pageRange', pageInfo)}
        page={pageInfo.page}
        totalPages={pageInfo.totalPages}
        previousHref={pageInfo.page > 1 ? `/${locale}${href(query.status, pageInfo.page - 1)}` : undefined}
        nextHref={pageInfo.page < pageInfo.totalPages ? `/${locale}${href(query.status, pageInfo.page + 1)}` : undefined}
        previousLabel={tAdmin('previous')}
        nextLabel={tAdmin('next')}
        pageSize={{
          action: `/${locale}/admin/media`,
          value: query.pageSize,
          options: PAGE_SIZE_OPTIONS,
          label: tAdmin('rowsPerPage'),
          params: query.status ? { status: query.status } : {},
        }}
      />
    </div>
  );
}
