import { InstructorCourseSchema, type CourseReviewEvent } from '@obgyn/types';
import { ArrowLeft, ExternalLink, Pencil, Send } from 'lucide-react';
import { getFormatter, getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { ReviewActions } from '@/components/instructor/review-actions';
import { ReviewHistoryList } from '@/components/instructor/review-history';
import { StatusBadge } from '@/components/instructor/status-badge';
import { Link } from '@/i18n/navigation';
import { ApiError, apiGet } from '@/lib/server-api';
import { requireInstructor } from '@/lib/instructor-server';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Instructor.reviewPage' });
  return { title: t('metaTitle'), robots: { index: false, follow: false } };
}

/**
 * Where a review notification leads: the current decision in full (who, when,
 * the reviewer's note), what to do next, and the whole review timeline.
 * Course team and admins.
 */
export default async function CourseReviewStatusPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const me = await requireInstructor(locale, `/instructor/courses/${id}/review`);
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [course, t, tInstructor, tAdmin, format] = await Promise.all([
    apiGet(`/instructor/courses/${id}`, InstructorCourseSchema, { auth: true }).catch((error) => {
      if (error instanceof ApiError && (error.status === 404 || error.status === 403)) notFound();
      throw error;
    }),
    getTranslations('Instructor.reviewPage'),
    getTranslations('Instructor'),
    getTranslations('Instructor'),
    getFormatter(),
  ]);

  const events = course.reviewHistory;
  const latest = (kind: CourseReviewEvent['kind']) =>
    events.find((event) => event.kind === kind) ?? null;
  const date = (event: CourseReviewEvent | null) =>
    event
      ? format.dateTime(new Date(event.createdAt), { dateStyle: 'long', timeStyle: 'short' })
      : '—';
  const sentBack =
    course.status === 'DRAFT' && events[0]?.kind === 'CHANGES_REQUESTED' ? events[0] : null;
  const state = sentBack
    ? 'CHANGES_REQUESTED'
    : course.status === 'IN_REVIEW'
      ? 'IN_REVIEW'
      : course.status === 'PUBLISHED'
        ? 'PUBLISHED'
        : 'DRAFT';
  const stateEvent =
    sentBack ??
    (state === 'IN_REVIEW'
      ? latest('SUBMITTED')
      : state === 'PUBLISHED'
        ? latest('PUBLISHED')
        : null);
  const tone = {
    CHANGES_REQUESTED: 'border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-950/30',
    IN_REVIEW: 'border-primary/30 bg-primary-light/50',
    PUBLISHED: 'border-green-300 bg-green-50 dark:border-green-800 dark:bg-green-950/30',
    DRAFT: 'border-border bg-card',
  }[state];
  const canDecide = me.role === 'ADMIN' && course.status === 'IN_REVIEW';
  const button =
    'inline-flex h-10 items-center gap-2 rounded-full px-5 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring';

  return (
    <div className="flex max-w-4xl flex-col gap-6">
      <Link
        href="/instructor/courses"
        className="flex w-fit items-center gap-2 text-sm text-muted-foreground hover:text-primary"
      >
        <ArrowLeft aria-hidden className="size-4 rtl:rotate-180" />
        {t('back')}
      </Link>

      <header className="flex flex-col gap-2">
        <p className="text-sm font-medium text-muted-foreground">{t('heading')}</p>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold md:text-3xl">{course.title}</h1>
          <StatusBadge status={course.status} label={tInstructor(`status.${course.status}`)} />
        </div>
      </header>

      <section
        aria-labelledby="review-state"
        className={`flex flex-col gap-4 rounded-2xl border p-6 ${tone}`}
      >
        <div className="flex flex-col gap-1">
          <h2 id="review-state" className="text-xl font-semibold">
            {t(`state.${state}.title`)}
          </h2>
          <p className="text-muted-foreground">
            {t(`state.${state}.body`, {
              name: stateEvent?.actorName ?? '—',
              date: date(stateEvent),
            })}
          </p>
        </div>

        {sentBack ? (
          <>
            <blockquote className="rounded-xl border-s-4 border-amber-400 bg-card px-5 py-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-amber-900 dark:text-amber-200">
                {tInstructor('reviewHistoryExtra.note')}
              </p>
              <p className="whitespace-pre-line text-base">
                {sentBack.note || tInstructor('reviewHistoryExtra.noNote')}
              </p>
            </blockquote>
            <div className="flex flex-col gap-2">
              <h3 className="font-semibold">{t('nextSteps')}</h3>
              <ol className="ms-5 list-decimal space-y-1 text-sm">
                <li>{t('step1')}</li>
                <li>{t('step2')}</li>
              </ol>
            </div>
          </>
        ) : null}

        <div className="flex flex-wrap gap-3">
          {course.status !== 'PUBLISHED' || state === 'PUBLISHED' ? (
            <Link
              href={`/instructor/courses/${course.id}`}
              className={`${button} border border-border bg-card hover:bg-muted`}
            >
              <Pencil aria-hidden className="size-4" />
              {t('editCourse')}
            </Link>
          ) : null}
          {course.status === 'DRAFT' && (course.myRole === 'OWNER' || course.myRole === 'ADMIN') ? (
            <Link
              href={`/instructor/courses/${course.id}?tab=publish`}
              className={`${button} bg-primary text-primary-foreground hover:bg-primary-hover`}
            >
              <Send aria-hidden className="size-4" />
              {t('goPublish')}
            </Link>
          ) : null}
          {course.status === 'PUBLISHED' ? (
            <Link
              href={`/courses/${course.slug}`}
              className={`${button} border border-border bg-card hover:bg-muted`}
            >
              <ExternalLink aria-hidden className="size-4" />
              {t('viewOnSite')}
            </Link>
          ) : null}
        </div>

        {canDecide ? (
          <div className="flex flex-col gap-2 border-t border-border pt-4">
            <h3 className="font-semibold">{t('adminDecide')}</h3>
            <ReviewActions
              approvePath={`admin/courses/${course.id}/publish`}
              rejectPath={`admin/courses/${course.id}/reject`}
              approveLabel={tAdmin('publish')}
              rejectLabel={tAdmin('reject')}
            />
          </div>
        ) : null}
      </section>

      <dl className="grid gap-3 sm:grid-cols-3">
        {[
          {
            label: t('stats.submitted'),
            value: String(events.filter((e) => e.kind === 'SUBMITTED').length),
          },
          {
            label: t('stats.changes'),
            value: String(events.filter((e) => e.kind === 'CHANGES_REQUESTED').length),
          },
          { label: t('stats.lastActivity'), value: date(events[0] ?? null) },
        ].map((stat) => (
          <div key={stat.label} className="rounded-2xl border border-border bg-card p-4">
            <dt className="text-sm text-muted-foreground">{stat.label}</dt>
            <dd className="mt-1 text-lg font-semibold">{stat.value}</dd>
          </div>
        ))}
      </dl>

      <section
        aria-labelledby="review-timeline"
        className="rounded-2xl border border-border bg-card p-6"
      >
        <h2 id="review-timeline" className="mb-5 text-lg font-semibold">
          {t('timeline')}
        </h2>
        <ReviewHistoryList events={events} />
      </section>
    </div>
  );
}
