import { InstructorSubmissionSchema, SUBMISSION_STATUSES, type SubmissionStatus } from '@obgyn/types';
import { getFormatter, getTranslations, setRequestLocale } from 'next-intl/server';
import { z } from 'zod';
import { SubmissionReview } from '@/components/instructor/submission-review';
import { Link } from '@/i18n/navigation';
import { apiGet } from '@/lib/server-api';
import { requireInstructor } from '@/lib/instructor-server';

type Props = { params: Promise<{ locale: string }>; searchParams: Promise<{ status?: string }> };

export default async function SubmissionsPage({ params, searchParams }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  // Pages render alongside the layout, so each checks the role before calling the API.
  await requireInstructor(locale, '/instructor/submissions');
  const requested = (await searchParams).status;
  const status: SubmissionStatus = SUBMISSION_STATUSES.find((s) => s === requested) ?? 'SUBMITTED';
  const [t, tAssignment, format, submissions] = await Promise.all([
    getTranslations('Instructor'),
    getTranslations('Assignment'),
    getFormatter(),
    apiGet(`/instructor/submissions?status=${status}`, z.array(InstructorSubmissionSchema), { auth: true }),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold md:text-3xl">{t('submissionsTitle')}</h1>
      <nav aria-label={t('submissionsTitle')} className="flex gap-2">
        {SUBMISSION_STATUSES.map((value) => (
          <Link
            key={value}
            href={`/instructor/submissions?status=${value}`}
            aria-current={value === status ? 'page' : undefined}
            className={`rounded-full px-4 py-1.5 text-sm font-medium ${
              value === status ? 'bg-primary text-primary-foreground' : 'border border-border bg-card hover:border-primary'
            }`}
          >
            {t(`submissionFilter.${value}`)}
          </Link>
        ))}
      </nav>
      {submissions.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border bg-card p-10 text-center text-muted-foreground">
          {t('submissionsEmpty')}
        </p>
      ) : (
        <ul className="flex flex-col gap-4">
          {submissions.map((submission) => (
            <li key={submission.id} className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="font-semibold">{submission.learner.displayName}</h2>
                <span className="text-sm text-muted-foreground">
                  {format.dateTime(new Date(submission.updatedAt), { dateStyle: 'medium', timeStyle: 'short' })}
                </span>
              </div>
              <p className="text-sm text-muted-foreground">
                {submission.course.title} · {submission.lesson.title}
                {submission.lesson.points ? ` · ${tAssignment('points', { points: submission.lesson.points })}` : ''}
              </p>
              {submission.text ? <p className="whitespace-pre-line rounded-lg bg-muted p-3 text-sm">{submission.text}</p> : null}
              {submission.status === 'SUBMITTED' ? (
                <SubmissionReview id={submission.id} fileAssetId={submission.fileAssetId} fileName={submission.fileName} />
              ) : submission.feedback ? (
                <p className="text-sm">{tAssignment('feedback', { feedback: submission.feedback })}</p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
