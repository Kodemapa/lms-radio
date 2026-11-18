import { AdminPager } from '@obgyn/ui';
import { getTranslations } from 'next-intl/server';
import { pageWindow, PAGE_SIZE_OPTIONS, withQuery } from '@/lib/admin-paging';

/**
 * Pager + rows-per-page menu for an admin list that is already loaded in full
 * (pending queues, UI texts). The page slices the rows with `pageWindow(...).offset`.
 */
export async function ListPager({
  locale,
  path,
  total,
  page,
  pageSize,
  params = {},
}: {
  locale: string;
  /** Admin path without locale, e.g. "/admin/courses/review". */
  path: string;
  total: number;
  page: number;
  pageSize: number;
  /** Other query parameters to keep (filters, search). */
  params?: Record<string, string>;
}) {
  const t = await getTranslations('Admin');
  const info = pageWindow(total, page, pageSize);
  const href = (target: number) => `/${locale}${withQuery(path, { ...params, page: target, pageSize })}`;
  return (
    <AdminPager
      ariaLabel={t('pages')}
      summary={t('pageRange', info)}
      page={info.page}
      totalPages={info.totalPages}
      previousHref={info.page > 1 ? href(info.page - 1) : undefined}
      nextHref={info.page < info.totalPages ? href(info.page + 1) : undefined}
      previousLabel={t('previous')}
      nextLabel={t('next')}
      pageSize={{
        action: `/${locale}${path}`,
        value: pageSize,
        options: PAGE_SIZE_OPTIONS,
        label: t('rowsPerPage'),
        params,
      }}
    />
  );
}
