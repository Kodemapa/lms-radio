import { ADMIN_DEFAULT_PAGE_SIZE, ReviewQueueItemSchema } from '@obgyn/types';
import { getFormatter, getTranslations, setRequestLocale } from 'next-intl/server';
import { z } from 'zod';
import { CourseThumbnail } from '@/components/course/course-thumbnail';
import { ReviewActions } from '@/components/instructor/review-actions';
import { Link } from '@/i18n/navigation';
import { ListPager } from '@/components/admin/list-pager';
import { pageWindow, readPage, readPageSize } from '@/lib/admin-paging';
import { apiGet } from '@/lib/server-api';
import { requireAdmin } from '@/lib/admin-server';

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
  const [t, tCommon, format] = await Promise.all([
    getTranslations('Instructor'),
    getTranslations('Common'),
    getFormatter(),
  ]);
  const queue = await apiGet('/admin/courses/review', z.array(ReviewQueueItemSchema), { auth: true });
  const raw = await searchParams;
  const pageSize = readPageSize(raw.pageSize, ADMIN_DEFAULT_PAGE_SIZE);
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
            <li key={course.id} className="grid gap-4 rounded-2xl border border-border bg-card p-4 md:grid-cols-[200px_1fr]">
              <CourseThumbnail assetId={course.thumbnailAssetId} title={course.title} seed={course.slug} />
              <div className="flex flex-col gap-2">
                <Link href={`/instructor/courses/${course.id}`} className="text-lg font-semibold hover:text-primary">
                  {course.title}
                </Link>
                <p className="text-sm text-muted-foreground">{course.shortDescription}</p>
                <p className="flex flex-wrap gap-x-4 text-sm text-muted-foreground">
                  {course.instructor ? <span>{tCommon('by', { name: course.instructor.displayName })}</span> : null}
                  {course.category ? <span>{course.category.name}</span> : null}
                  <span>{tCommon('lessons', { count: course.lessonCount })}</span>
                  {course.submittedAt ? (
                    <span>{t('submittedOn', { date: format.dateTime(new Date(course.submittedAt), { dateStyle: 'medium' }) })}</span>
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
        <ListPager locale={locale} path="/admin/courses/review" total={queue.length} page={page.page} pageSize={pageSize} />
      ) : null}
    </div>
  );
}
