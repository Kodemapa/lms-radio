import { InstructorSubmissionSchema, SUBMISSION_STATUSES, type SubmissionStatus } from '@obgyn/types';
import { AdminPager } from '@obgyn/ui';
import { getFormatter, getTranslations, setRequestLocale } from 'next-intl/server';
import { z } from 'zod';
import { SubmissionReview } from '@/components/instructor/submission-review';
import { Link } from '@/i18n/navigation';
import { apiGet } from '@/lib/server-api';
import { pageWindow, PAGE_SIZE_OPTIONS, readPage, readPageSize, stringParams, withQuery } from '@/lib/admin-paging';
import { requireInstructor } from '@/lib/instructor-server';

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
        <p className="soft-wash rounded-3xl p-10 text-center text-muted-foreground">
          {t('submissionsEmpty')}
        </p>
      ) : (
        <ul className="flex flex-col gap-4">
          {shown.map((submission) => (
            <li key={submission.id} className="flex flex-col gap-3 surface p-5">
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
