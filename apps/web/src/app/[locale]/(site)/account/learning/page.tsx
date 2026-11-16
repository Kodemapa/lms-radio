import { MyCourseSchema } from '@obgyn/types';
import { Progress } from '@obgyn/ui';
import { Award, BarChart3, CheckCircle2 } from 'lucide-react';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { z } from 'zod';
import { CourseThumbnail } from '@/components/course/course-thumbnail';
import { Link } from '@/i18n/navigation';
import { apiGet } from '@/lib/server-api';

export default async function MyLearningPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const [t, tPlayer, courses] = await Promise.all([
    getTranslations('Account'),
    getTranslations('Player'),
    apiGet('/users/me/learning', z.array(MyCourseSchema), { auth: true }),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold md:text-3xl">{t('learningTitle')}</h1>
      {courses.length === 0 ? (
        <div className="flex flex-col items-center gap-4 soft-wash rounded-3xl p-10 text-center">
          <p className="text-muted-foreground">{t('learningEmpty')}</p>
          <Link href="/courses" className="rounded-full bg-primary px-5 py-2.5 font-medium text-primary-foreground">{t('browse')}</Link>
        </div>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {courses.map(({ course, progress, resumeLessonId, certificateSerial }) => {
            const done = progress.total > 0 && progress.completed === progress.total;
            return (
              <li key={course.id} className="flex flex-col gap-3 surface p-4">
                <Link href={`/courses/${course.slug}`}>
                  <CourseThumbnail assetId={course.thumbnailAssetId} title={course.title} seed={course.slug} />
                </Link>
                <h2 className="line-clamp-2 font-semibold">{course.title}</h2>
                <div className="flex flex-col gap-1.5">
                  <Progress value={progress.percent} aria-label={tPlayer('progress', { percent: progress.percent })} />
                  <p className="flex justify-between text-xs text-muted-foreground">
                    <span>{tPlayer('progress', { percent: progress.percent })}</span>
                    <span>{tPlayer('lessonsDone', { done: progress.completed, total: progress.total })}</span>
                  </p>
                </div>
                <div className="mt-auto flex flex-wrap items-center gap-2">
                  {resumeLessonId ? (
                    <Link
                      href={`/learn/${course.slug}/${resumeLessonId}`}
                      className="rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary-hover"
                    >
                      {done ? t('completedCourse') : progress.completed > 0 ? t('continue') : t('start')}
                    </Link>
                  ) : null}
                  {done && !certificateSerial ? (
                    <span className="flex items-center gap-1 text-sm text-success"><CheckCircle2 aria-hidden className="size-4" />{t('completedCourse')}</span>
                  ) : null}
                  <Link href={`/account/learning/${course.slug}`} className="flex items-center gap-1.5 text-sm font-medium text-primary hover:underline">
                    <BarChart3 aria-hidden className="size-4" />
                    {t('progressReport')}
                  </Link>
                  {certificateSerial ? (
                    <Link href={`/certificates/${certificateSerial}`} className="flex items-center gap-1.5 text-sm font-medium text-primary hover:underline">
                      <Award aria-hidden className="size-4" />
                      {t('certificate')}
                    </Link>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
