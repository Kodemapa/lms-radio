import { InstructorSubmissionSchema, SUBMISSION_STATUSES, type SubmissionStatus } from '@obgyn/types';
import { AdminPager } from '@obgyn/ui';
import { getFormatter, getTranslations, setRequestLocale } from 'next-intl/server';
import { z } from 'zod';
import { SubmissionAttachment, SubmissionReview } from '@/components/instructor/submission-review';
import { Link } from '@/i18n/navigation';
import { apiGet } from '@/lib/server-api';
import { pageWindow, PAGE_SIZE_OPTIONS, readPage, readPageSize, stringParams, withQuery } from '@/lib/admin-paging';
import { requireInstructor } from '@/lib/instructor-server';
import { initials } from '@/lib/initials';

const STATUS_TONE: Record<SubmissionStatus, string> = {
  SUBMITTED: 'bg-primary-light text-primary',
  APPROVED: 'bg-green-50 text-green-900 dark:bg-green-900/30 dark:text-green-100',
  REJECTED: 'bg-amber-50 text-amber-900 dark:bg-amber-900/30 dark:text-amber-100',
};

type Props = { params: Promise<{ locale: string }>; searchParams: Promise<{ status?: string; page?: string; pageSize?: string }> };

export default async function SubmissionsPage({ params, searchParams }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  // Pages render alongside the layout, so each checks the role before calling the API.
  await requireInstructor(locale, '/instructor/submissions');
  const query = await searchParams;
  const requested = query.status;
  const status: SubmissionStatus = SUBMISSION_STATUSES.find((s) => s === requested) ?? 'SUBMITTED';
  const [t, tAdmin, tCommon, tAssignment, format, submissions] = await Promise.all([
    getTranslations('Instructor'),
    getTranslations('Admin'),
    getTranslations('Common'),
    getTranslations('Assignment'),
    getFormatter(),
    apiGet(`/instructor/submissions?status=${status}`, z.array(InstructorSubmissionSchema), { auth: true }),
  ]);

  const pageSize = readPageSize(query.pageSize, 10);
  const win = pageWindow(submissions.length, readPage(query.page), pageSize);
  const shown = submissions.slice(win.offset, win.offset + pageSize);
  const path = `/${locale}/instructor/submissions`;
  const keep = { status, pageSize: pageSize === 10 ? undefined : pageSize };

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold md:text-3xl">{t('submissionsTitle')}</h1>
      <nav aria-label={t('submissionsTitle')} className="flex flex-wrap gap-2">
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
        <p className="soft-wash rounded-3xl p-10 text-center text-muted-foreground">
          {t(`submissionsEmptyBy.${status}`)}
        </p>
      ) : (
        <ul className="flex flex-col gap-4">
          {shown.map((submission) => (
            <li key={submission.id} className="surface overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3 sm:px-5">
                <div className="flex min-w-0 items-center gap-3">
                  <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-full bg-primary-light text-sm font-semibold text-primary">
                    {initials(submission.learner.displayName) || '•'}
                  </span>
                  <div className="min-w-0">
                    <h2 className="truncate font-semibold">{submission.learner.displayName}</h2>
                    <p className="truncate text-sm text-muted-foreground">
                      {submission.course.title} · {submission.lesson.title}
                      {submission.lesson.points ? ` · ${tAssignment('points', { points: submission.lesson.points })}` : ''}
                    </p>
                  </div>
                </div>
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${STATUS_TONE[submission.status]}`}>
                  {t(`submissionFilter.${submission.status}`)}
                </span>
              </div>
              <div className="flex flex-col gap-4 p-4 sm:p-5">
                {/* The learner's message, then the instructor's reply: read like a conversation. */}
                <div className="flex max-w-3xl flex-col gap-2">
                  <p className="text-xs text-muted-foreground">
                    {t('learnerWrote', { name: submission.learner.displayName })} ·{' '}
                    <time dateTime={submission.updatedAt}>
                      {format.dateTime(new Date(submission.updatedAt), { dateStyle: 'medium', timeStyle: 'short' })}
                    </time>
                  </p>
                  <div className="flex flex-col gap-3 rounded-2xl rounded-ss-md bg-muted p-4">
                    {submission.text ? (
                      <p className="whitespace-pre-line break-words text-sm leading-relaxed">{submission.text}</p>
                    ) : (
                      <p className="text-sm italic text-muted-foreground">{t('noAnswerText')}</p>
                    )}
                    {submission.fileAssetId ? (
                      <SubmissionAttachment fileAssetId={submission.fileAssetId} fileName={submission.fileName} />
                    ) : null}
                  </div>
                </div>
                {submission.status === 'SUBMITTED' ? (
                  <SubmissionReview id={submission.id} />
                ) : (
                  <div className="flex max-w-3xl flex-col gap-2 self-end text-end">
                    <p className="text-xs text-muted-foreground">{t('yourFeedback')}</p>
                    <p className="whitespace-pre-line break-words rounded-2xl rounded-se-md bg-primary-light p-4 text-start text-sm leading-relaxed">
                      {submission.feedback || t('noFeedback')}
                    </p>
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      {submissions.length > PAGE_SIZE_OPTIONS[0]! ? (
        <AdminPager
          ariaLabel={tAdmin('pages')}
          summary={tAdmin('pageRange', { start: win.start, end: win.end, total: submissions.length })}
          page={win.page}
          totalPages={win.totalPages}
          previousHref={win.page > 1 ? withQuery(path, { ...keep, page: win.page - 1 }) : undefined}
          nextHref={win.page < win.totalPages ? withQuery(path, { ...keep, page: win.page + 1 }) : undefined}
          previousLabel={tCommon('previous')}
          nextLabel={tCommon('next')}
          pageSize={{ action: path, value: pageSize, options: PAGE_SIZE_OPTIONS, label: tAdmin('rowsPerPage'), params: stringParams({ status }) }}
        />
      ) : null}
    </div>
  );
}
