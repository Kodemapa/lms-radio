import {
  ADMIN_DEFAULT_PAGE_SIZE,
  AdminReviewHistorySchema,
  ReviewQueueItemSchema,
} from '@obgyn/types';
import { AdminPager } from '@obgyn/ui';
import { getFormatter, getTranslations, setRequestLocale } from 'next-intl/server';
import { z } from 'zod';
import { CourseThumbnail } from '@/components/course/course-thumbnail';
import { ReviewActions } from '@/components/instructor/review-actions';
import { ReviewHistoryList } from '@/components/instructor/review-history';
import { Link } from '@/i18n/navigation';
import { ListPager } from '@/components/admin/list-pager';
import {
  pageWindow,
  PAGE_SIZE_OPTIONS,
  readPage,
  readPageSize,
  stringParams,
  withQuery,
} from '@/lib/admin-paging';
import { apiGet } from '@/lib/server-api';
import { requireAdmin } from '@/lib/admin-server';
import { rememberedPageSize } from '@/lib/admin-page-size';

export default async function AdminCourseReviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireAdmin(locale, '/admin/courses/review');
  const [t, tCommon, tAdmin, format] = await Promise.all([
    getTranslations('Instructor'),
    getTranslations('Common'),
    getTranslations('Admin'),
    getFormatter(),
  ]);
  const raw = await searchParams;
  const pageSize = await rememberedPageSize(raw.pageSize, ADMIN_DEFAULT_PAGE_SIZE);
  // The history has its own page and size, so paging one list never resets the other.
  const historyPageSize = readPageSize(raw.historyPageSize, ADMIN_DEFAULT_PAGE_SIZE);
  const historyPage = readPage(raw.historyPage);
  const [queue, history] = await Promise.all([
    apiGet('/admin/courses/review', z.array(ReviewQueueItemSchema), { auth: true }),
    apiGet(
      `/admin/courses/review/history?page=${historyPage}&pageSize=${historyPageSize}`,
      AdminReviewHistorySchema,
      { auth: true },
    ),
  ]);
  const page = pageWindow(queue.length, readPage(raw.page), pageSize);
  const visible = queue.slice(page.offset, page.offset + pageSize);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold md:text-3xl">{t('reviewTitle')}</h1>
        <p className="text-muted-foreground">{t('reviewIntro')}</p>
      </div>
      {queue.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border bg-card p-10 text-center text-muted-foreground">
          {t('reviewEmpty')}
        </p>
      ) : (
        <ul className="flex flex-col gap-4">
          {visible.map((course) => (
            <li
              key={course.id}
              className="grid gap-4 rounded-2xl border border-border bg-card p-4 md:grid-cols-[200px_1fr]"
            >
              <CourseThumbnail
                assetId={course.thumbnailAssetId}
                title={course.title}
                seed={course.slug}
              />
              <div className="flex flex-col gap-2">
                <Link
                  href={`/instructor/courses/${course.id}`}
                  className="text-lg font-semibold hover:text-primary"
                >
                  {course.title}
                </Link>
                <p className="text-sm text-muted-foreground">{course.shortDescription}</p>
                <p className="flex flex-wrap gap-x-4 text-sm text-muted-foreground">
                  {course.instructor ? (
                    <span>{tCommon('by', { name: course.instructor.displayName })}</span>
                  ) : null}
                  {course.category ? <span>{course.category.name}</span> : null}
                  <span>{tCommon('lessons', { count: course.lessonCount })}</span>
                  {course.submittedAt ? (
                    <span>
                      {t('submittedOn', {
                        date: format.dateTime(new Date(course.submittedAt), {
                          dateStyle: 'medium',
                        }),
                      })}
                    </span>
                  ) : null}
                </p>
                <ReviewActions
                  approvePath={`admin/courses/${course.id}/publish`}
                  rejectPath={`admin/courses/${course.id}/reject`}
                  approveLabel={t('publish')}
                  rejectLabel={t('reject')}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
      {queue.length > 0 ? (
        <ListPager
          locale={locale}
          path="/admin/courses/review"
          total={queue.length}
          page={page.page}
          pageSize={pageSize}
        />
      ) : null}
      <section aria-labelledby="review-activity" className="flex flex-col gap-4">
        <div>
          <h2 id="review-activity" className="text-xl font-semibold">
            {t('recentActivity')}
          </h2>
          <p className="text-sm text-muted-foreground">{t('recentActivityIntro')}</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-5">
          <ReviewHistoryList
            events={history.items}
            courseOf={(event) => (
              <>
                <Link
                  href={`/instructor/courses/${event.course.id}`}
                  className="font-medium text-primary hover:underline"
                >
                  {event.course.title}
                </Link>
                {event.instructorName ? (
                  <span className="text-muted-foreground">
                    {' '}
                    · {tCommon('by', { name: event.instructorName })}
                  </span>
                ) : null}
              </>
            )}
          />
        </div>
        {history.total > PAGE_SIZE_OPTIONS[0]!
          ? (() => {
              const win = pageWindow(history.total, history.page, historyPageSize);
              const path = `/${locale}/admin/courses/review`;
              const keep = {
                page: raw.page as string | undefined,
                pageSize: raw.pageSize as string | undefined,
                historyPageSize,
              };
              return (
                <AdminPager
                  ariaLabel={t('recentActivity')}
                  summary={tAdmin('pageRange', {
                    start: win.start,
                    end: win.end,
                    total: history.total,
                  })}
                  page={win.page}
                  totalPages={win.totalPages}
                  previousHref={
                    win.page > 1
                      ? withQuery(path, { ...keep, historyPage: win.page - 1 })
                      : undefined
                  }
                  nextHref={
                    win.page < win.totalPages
                      ? withQuery(path, { ...keep, historyPage: win.page + 1 })
                      : undefined
                  }
                  previousLabel={tCommon('previous')}
                  nextLabel={tCommon('next')}
                  pageSize={{
                    action: path,
                    name: 'historyPageSize',
                    value: historyPageSize,
                    options: PAGE_SIZE_OPTIONS,
                    label: tAdmin('rowsPerPage'),
                    params: stringParams({ page: keep.page, pageSize: keep.pageSize }),
                  }}
                />
              );
            })()
          : null}
      </section>
    </div>
  );
}
