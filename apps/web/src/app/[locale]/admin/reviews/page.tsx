import { ADMIN_DEFAULT_PAGE_SIZE, ADMIN_REVIEW_STATUSES, AdminReviewListSchema, AdminReviewQuerySchema, REVIEW_REPORT_REASONS } from '@obgyn/types';
import { Star } from 'lucide-react';
import { AdminPager } from '@obgyn/ui';
import { getFormatter, getTranslations, setRequestLocale } from 'next-intl/server';
import { ReasonAction } from '@/components/admin/reason-action';
import { Link } from '@/i18n/navigation';
import { requireAdmin } from '@/lib/admin-server';
import { apiGet } from '@/lib/server-api';
import { pageWindow, PAGE_SIZE_OPTIONS, readPageSize, withQuery } from '@/lib/admin-paging';

type SearchParams = Record<string, string | string[] | undefined>;

export default async function AdminReviewsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireAdmin(locale, '/admin/reviews');
  const [t, tAdmin, format, raw] = await Promise.all([
    getTranslations('Admin.moderation'),
    getTranslations('Admin'),
    getFormatter(),
    searchParams,
  ]);
  const query = AdminReviewQuerySchema.catch(AdminReviewQuerySchema.parse({})).parse({
    status: typeof raw.status === 'string' ? raw.status : undefined,
    page: typeof raw.page === 'string' ? raw.page : undefined,
    pageSize: readPageSize(raw.pageSize, ADMIN_DEFAULT_PAGE_SIZE),
  });
  const result = await apiGet(
    withQuery('/admin/reviews', { status: query.status, page: query.page, pageSize: query.pageSize }),
    AdminReviewListSchema,
    { auth: true },
  );
  const href = (changes: { status?: string; page?: number }) =>
    withQuery('/admin/reviews', {
      status: changes.status ?? query.status,
      page: changes.page ?? 1,
      pageSize: query.pageSize,
    });
  const pageInfo = pageWindow(result.total, query.page, query.pageSize);
  const errors = { ALREADY_HIDDEN: t('errors.alreadyHidden'), NOT_HIDDEN: t('errors.notHidden'), NOT_REPORTED: t('errors.notReported') };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold md:text-3xl">{t('title')}</h1>
        <p className="text-muted-foreground">{t('intro')}</p>
      </div>

      <nav aria-label={t('filter')} className="flex flex-wrap gap-2">
        {ADMIN_REVIEW_STATUSES.map((status) => (
          <Link
            key={status}
            href={href({ status })}
            aria-current={query.status === status ? 'page' : undefined}
            className={`rounded-full px-4 py-2 text-sm font-medium ${
              query.status === status ? 'bg-secondary text-secondary-foreground' : 'border border-border bg-card hover:bg-muted'
            }`}
          >
            {t(`statuses.${status}`)}
          </Link>
        ))}
      </nav>

      {result.items.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border bg-card p-10 text-center text-muted-foreground">{t('empty')}</p>
      ) : (
        <ul className="flex flex-col gap-4">
          {result.items.map((review) => {
            const base = `admin/reviews/${review.courseId}/${review.userId}`;
            return (
              <li key={`${review.courseId}:${review.userId}`} className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <Link href={`/courses/${review.courseSlug}`} className="font-semibold hover:text-primary hover:underline">
                    {review.courseTitle}
                  </Link>
                  <span className="text-sm text-muted-foreground">
                    {format.dateTime(new Date(review.createdAt), { dateStyle: 'medium' })}
                  </span>
                </div>
                <p className="flex items-center gap-2 text-sm">
                  <span className="font-medium">{review.authorName}</span>
                  <span className="flex items-center gap-1" aria-label={t('rating', { rating: review.rating })}>
                    <Star aria-hidden className="size-4 fill-current text-rating" />
                    {review.rating}/5
                  </span>
                  {review.hiddenAt ? (
                    <span className="rounded-full bg-muted px-2 py-0.5 text-xs">{t('hiddenBadge')}</span>
                  ) : null}
                </p>
                <p className="whitespace-pre-line">{review.comment || <span className="text-muted-foreground">{t('noComment')}</span>}</p>
                {review.reply ? (
                  <p className="whitespace-pre-line border-s-2 border-border ps-3 text-sm text-muted-foreground">{review.reply}</p>
                ) : null}
                {review.reportedAt ? (
                  <p className="rounded-xl bg-accent-light p-3 text-sm text-accent-deep">
                    {t('reportedBy', {
                      name: review.reportedByName ?? t('courseTeam'),
                      date: format.dateTime(new Date(review.reportedAt), { dateStyle: 'medium' }),
                      reason: t(
                        `reasons.${(REVIEW_REPORT_REASONS as readonly string[]).includes(review.reportReason ?? '') ? review.reportReason : 'OTHER'}`,
                      ),
                    })}
                  </p>
                ) : null}
                <div className="flex flex-wrap gap-2">
                  {review.hiddenAt ? (
                    <ReasonAction
                      path={`${base}/restore`}
                      label={t('restore')}
                      title={t('restoreTitle')}
                      description={t('restoreBody')}
                      errorMessages={errors}
                    />
                  ) : (
                    <>
                      <ReasonAction
                        path={`${base}/hide`}
                        label={t('hide')}
                        title={t('hideTitle')}
                        description={t('hideBody')}
                        destructive
                        errorMessages={errors}
                      />
                      {review.reportedAt ? (
                        <ReasonAction
                          path={`${base}/dismiss`}
                          label={t('dismiss')}
                          title={t('dismissTitle')}
                          description={t('dismissBody')}
                          errorMessages={errors}
                        />
                      ) : null}
                    </>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <AdminPager
        ariaLabel={tAdmin('pages')}
        summary={tAdmin('pageRange', pageInfo)}
        page={pageInfo.page}
        totalPages={pageInfo.totalPages}
        previousHref={pageInfo.page > 1 ? `/${locale}${href({ page: pageInfo.page - 1 })}` : undefined}
        nextHref={pageInfo.page < pageInfo.totalPages ? `/${locale}${href({ page: pageInfo.page + 1 })}` : undefined}
        previousLabel={tAdmin('previous')}
        nextLabel={tAdmin('next')}
        pageSize={{
          action: `/${locale}/admin/reviews`,
          value: query.pageSize,
          options: PAGE_SIZE_OPTIONS,
          label: tAdmin('rowsPerPage'),
          params: { status: query.status },
        }}
      />
    </div>
  );
}
