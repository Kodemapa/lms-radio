import { ReviewQueueItemSchema } from '@obgyn/types';
import { getFormatter, getTranslations, setRequestLocale } from 'next-intl/server';
import { z } from 'zod';
import { CourseThumbnail } from '@/components/course/course-thumbnail';
import { ReviewActions } from '@/components/instructor/review-actions';
import { Link } from '@/i18n/navigation';
import { getMe } from '@/lib/catalog';
import { apiGet } from '@/lib/server-api';
import { requireInstructor } from '@/lib/instructor-server';

export default async function ReviewPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  // Pages render alongside the layout, so each checks the role before calling the API.
  await requireInstructor(locale, '/instructor/review');
  const [t, tCommon, format, me] = await Promise.all([
    getTranslations('Instructor'),
    getTranslations('Common'),
    getFormatter(),
    getMe(),
  ]);
  if (me?.role !== 'ADMIN') return <p role="alert">{t('notAllowed')}</p>;
  const queue = await apiGet('/admin/courses/review', z.array(ReviewQueueItemSchema), { auth: true });

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
          {queue.map((course) => (
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
    </div>
  );
}
