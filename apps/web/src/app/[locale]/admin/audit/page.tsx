import { ADMIN_PAGE_SIZE_COOKIE, AdminAuditPageSchema, AdminAuditQuerySchema } from '@obgyn/types';
import { AdminPager, Button, Input, Label } from '@obgyn/ui';
import { getFormatter, getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { requireAdmin } from '@/lib/admin-server';
import { rememberedPageSize } from '@/lib/admin-page-size';
import { apiGet } from '@/lib/server-api';
import { ADMIN_DEFAULT_PAGE_SIZE } from '@obgyn/types';
import { PAGE_SIZE_OPTIONS } from '@/lib/admin-paging';

type SearchParams = Record<string, string | string[] | undefined>;
const FILTERS = ['actorId', 'action', 'resource', 'resourceId', 'from', 'to'] as const;

export default async function AdminAuditPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireAdmin(locale, '/admin/audit');
  const [t, tAdmin, format, raw] = await Promise.all([
    getTranslations('Admin.audit'),
    getTranslations('Admin'),
    getFormatter(),
    searchParams,
  ]);
  const limit = await rememberedPageSize(raw.limit, ADMIN_DEFAULT_PAGE_SIZE);

  // Keep only non-empty, valid filters (an invalid one is dropped rather than erroring).
  const values: Record<string, string> = {};
  for (const key of [...FILTERS, 'cursor'] as const) {
    const value = raw[key];
    if (typeof value === 'string' && value.trim()) values[key] = value.trim();
  }
  const parsed = AdminAuditQuerySchema.safeParse({ ...values, limit });
  const query = parsed.success ? parsed.data : AdminAuditQuerySchema.parse({});
  const filters = new URLSearchParams();
  for (const key of FILTERS) if (query[key]) filters.set(key, query[key]!);
  // Paging links keep the rows-per-page choice; the CSV export ignores it.
  const listing = new URLSearchParams(filters);
  listing.set('limit', String(limit));

  const api = new URLSearchParams(listing);
  if (query.cursor) api.set('cursor', query.cursor);
  const page = await apiGet(`/admin/audit?${api}`, AdminAuditPageSchema, { auth: true });
  const olderHref = page.nextCursor
    ? `/${locale}/admin/audit?${new URLSearchParams({ ...Object.fromEntries(listing), cursor: page.nextCursor })}`
    : undefined;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold md:text-3xl">{t('title')}</h1>
          <p className="text-muted-foreground">{t('intro')}</p>
        </div>
        <a
          href={`/api/proxy/admin/audit/export?${filters}`}
          className="rounded-full border border-border bg-card px-4 py-2 text-sm font-medium hover:bg-muted"
          download
        >
          {t('export')}
        </a>
      </div>

      <form method="get" className="grid gap-3 rounded-2xl border border-border bg-card p-4 sm:grid-cols-2 lg:grid-cols-3">
        <input type="hidden" name="limit" value={limit} />
        {FILTERS.map((key) => (
          <div key={key} className="flex flex-col gap-1.5">
            <Label htmlFor={`audit-${key}`}>{t(`filters.${key}`)}</Label>
            <Input
              id={`audit-${key}`}
              name={key}
              type={key === 'from' || key === 'to' ? 'date' : 'text'}
              defaultValue={query[key] ?? ''}
              placeholder={key === 'action' ? 'admin.' : undefined}
            />
          </div>
        ))}
        <div className="flex items-end gap-2">
          <Button type="submit">{t('apply')}</Button>
          <Link href="/admin/audit" className="rounded-md px-3 py-2 text-sm text-muted-foreground hover:text-primary">{t('clear')}</Link>
        </div>
      </form>
      {!parsed.success ? <p role="alert" className="text-sm text-destructive">{t('invalidFilters')}</p> : null}

      <div className="max-h-[min(70vh,48rem)] overflow-auto rounded-2xl border border-border bg-card">
        <table className="w-full min-w-[820px] text-left text-sm">
          <caption className="sr-only">{t('title')}</caption>
          <thead className="sticky top-0 z-10 border-b border-border bg-muted text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th scope="col" className="px-4 py-3">{t('table.time')}</th>
              <th scope="col" className="px-4 py-3">{t('table.actor')}</th>
              <th scope="col" className="px-4 py-3">{t('table.action')}</th>
              <th scope="col" className="px-4 py-3">{t('table.resource')}</th>
              <th scope="col" className="px-4 py-3">{t('table.details')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {page.items.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-10 text-center text-muted-foreground">{t('empty')}</td>
              </tr>
            ) : (
              page.items.map((entry) => (
                <tr key={entry.id} className="align-top">
                  <td className="whitespace-nowrap px-4 py-3">
                    {format.dateTime(new Date(entry.createdAt), { dateStyle: 'medium', timeStyle: 'short' })}
                  </td>
                  <td className="px-4 py-3">
                    {entry.actorId ? (
                      <Link href={`/admin/users/${entry.actorId}`} className="hover:text-primary hover:underline">
                        {entry.actorName ?? t('unknownActor')}
                      </Link>
                    ) : (
                      <span className="text-muted-foreground">{t('system')}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">{entry.action}</td>
                  <td className="px-4 py-3">
                    <span>{entry.resource}</span>
                    {entry.resourceId ? <span className="block break-all font-mono text-xs text-muted-foreground">{entry.resourceId}</span> : null}
                  </td>
                  <td className="px-4 py-3">
                    {entry.metadata !== null && entry.metadata !== undefined ? (
                      <details>
                        <summary className="cursor-pointer text-primary">{t('show')}</summary>
                        <pre className="mt-2 max-w-md overflow-x-auto whitespace-pre-wrap break-all rounded-md bg-muted p-2 text-xs">
                          {JSON.stringify(entry.metadata, null, 2)}
                        </pre>
                      </details>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Audit paging is "newest first, then older": there is no total page count. */}
      <AdminPager
        ariaLabel={t('paging')}
        previousHref={query.cursor ? `/${locale}/admin/audit?${listing}` : undefined}
        nextHref={olderHref}
        previousLabel={t('newest')}
        nextLabel={t('older')}
        pageSize={{
          action: `/${locale}/admin/audit`,
          name: 'limit',
          value: limit,
          options: PAGE_SIZE_OPTIONS,
          label: tAdmin('rowsPerPage'),
          params: Object.fromEntries(filters),
          cookie: ADMIN_PAGE_SIZE_COOKIE,
        }}
      />
    </div>
  );
}
