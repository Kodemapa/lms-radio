import { ADMIN_DEFAULT_PAGE_SIZE, ApplicationFieldSchema, InstructorApplicationSchema } from '@obgyn/types';
import { Link } from '@/i18n/navigation';
import { getFormatter, getTranslations, setRequestLocale } from 'next-intl/server';
import { z } from 'zod';
import { ReviewActions } from '@/components/instructor/review-actions';
import { ListPager } from '@/components/admin/list-pager';
import { pageWindow, readPage } from '@/lib/admin-paging';
import { apiGet } from '@/lib/server-api';
import { requireAdmin } from '@/lib/admin-server';
import { rememberedPageSize } from '@/lib/admin-page-size';

const STATUSES = ['PENDING', 'APPROVED', 'REJECTED'] as const;
const STATUS_TONE = {
  PENDING: 'bg-primary-light text-primary',
  APPROVED: 'bg-green-50 text-green-900 dark:bg-green-900/30 dark:text-green-100',
  REJECTED: 'bg-amber-50 text-amber-900 dark:bg-amber-900/30 dark:text-amber-100',
} as const;

export default async function AdminApplicationsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireAdmin(locale, '/admin/instructor-applications');
  const raw = await searchParams;
  const status = STATUSES.find((value) => value === raw.status) ?? 'PENDING';
  const [t, format] = await Promise.all([getTranslations('Instructor'), getFormatter()]);
  const [list, fields] = await Promise.all([
    apiGet(`/admin/instructor-applications?status=${status}`, z.array(InstructorApplicationSchema), { auth: true }),
    apiGet('/admin/application-fields', z.array(ApplicationFieldSchema), { auth: true }),
  ]);
  // Pending: oldest first (first come, first served). Decided: most recent first.
  const applications = status === 'PENDING' ? list : [...list].reverse();
  const fieldsByKey = new Map(fields.map((field) => [field.key, field]));
  const pageSize = await rememberedPageSize(raw.pageSize, ADMIN_DEFAULT_PAGE_SIZE);
  const page = pageWindow(applications.length, readPage(raw.page), pageSize);
  const visible = applications.slice(page.offset, page.offset + pageSize);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold md:text-3xl">{t('applicationsTitle')}</h1>
      <nav aria-label={t('applicationsTitle')} className="flex flex-wrap gap-2">
        {STATUSES.map((value) => (
          <Link
            key={value}
            href={value === 'PENDING' ? '/admin/instructor-applications' : `/admin/instructor-applications?status=${value}`}
            aria-current={value === status ? 'page' : undefined}
            className={`rounded-full px-4 py-1.5 text-sm font-medium ${
              value === status ? 'bg-primary text-primary-foreground' : 'border border-border bg-card hover:border-primary'
            }`}
          >
            {t(`applicationStatus.${value}`)}
          </Link>
        ))}
      </nav>
      {applications.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border bg-card p-10 text-center text-muted-foreground">
          {t(`applicationsEmptyBy.${status}`)}
        </p>
      ) : (
        <ul className="flex flex-col gap-4">
          {visible.map((application) => (
            <li key={application.id} className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="flex flex-wrap items-center gap-2 text-lg font-semibold">
                  {application.applicant.displayName}
                  {application.status !== 'PENDING' ? (
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_TONE[application.status]}`}>
                      {t(`applicationStatus.${application.status}`)}
                    </span>
                  ) : null}
                </h2>
                <span className="text-sm text-muted-foreground">
                  {format.dateTime(new Date(application.createdAt), { dateStyle: 'medium' })}
                </span>
              </div>
              <p className="font-medium">{application.headline}</p>
              <p className="flex flex-wrap gap-x-4 text-sm text-muted-foreground">
                <span>{application.qualifications}</span>
                <span>{t('experience', { years: application.experienceYears })}</span>
                {application.registrationNumber ? (
                  <span>{t('registration', { number: application.registrationNumber })}</span>
                ) : null}
                <span>{application.applicant.email ?? application.applicant.phone}</span>
              </p>
              <p className="whitespace-pre-line text-sm">{application.bio}</p>
              {Object.keys(application.answers).length ? (
                <section aria-label={t('applicationAnswers')} className="rounded-xl bg-muted/50 p-4">
                  <h3 className="mb-2 font-semibold">{t('applicationAnswers')}</h3>
                  <dl className="grid gap-3 sm:grid-cols-2">
                    {Object.entries(application.answers).map(([key, value]) => {
                      const field = fieldsByKey.get(key);
                      const label = field?.label ?? key;
                      return (
                        <div key={key}>
                          <dt className="text-sm text-muted-foreground">{label}</dt>
                          <dd className="whitespace-pre-wrap font-medium">{String(value)}</dd>
                        </div>
                      );
                    })}
                  </dl>
                </section>
              ) : null}
              {application.status === 'PENDING' ? (
                <ReviewActions
                  approvePath={`admin/instructor-applications/${application.id}/approve`}
                  rejectPath={`admin/instructor-applications/${application.id}/reject`}
                  approveLabel={t('approve')}
                  rejectLabel={t('decline')}
                />
              ) : application.reviewNote ? (
                <p className="rounded-xl border border-border bg-muted/40 p-3 text-sm">
                  <span className="font-semibold">{t('reviewNoteLabel')}</span> {application.reviewNote}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
      {applications.length > 0 ? (
        <ListPager
          locale={locale}
          path="/admin/instructor-applications"
          params={status === 'PENDING' ? undefined : { status }}
          total={applications.length}
          page={page.page}
          pageSize={pageSize}
        />
      ) : null}
    </div>
  );
}
