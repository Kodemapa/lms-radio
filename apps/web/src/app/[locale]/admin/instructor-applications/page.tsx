import { ApplicationFieldSchema, InstructorApplicationSchema } from '@obgyn/types';
import { getFormatter, getTranslations, setRequestLocale } from 'next-intl/server';
import { z } from 'zod';
import { ReviewActions } from '@/components/instructor/review-actions';
import { apiGet } from '@/lib/server-api';
import { requireAdmin } from '@/lib/admin-server';

export default async function AdminApplicationsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireAdmin(locale, '/admin/instructor-applications');
  const [t, format] = await Promise.all([getTranslations('Instructor'), getFormatter()]);
  const [applications, fields] = await Promise.all([
    apiGet('/admin/instructor-applications?status=PENDING', z.array(InstructorApplicationSchema), { auth: true }),
    apiGet('/admin/application-fields', z.array(ApplicationFieldSchema), { auth: true }),
  ]);
  const fieldsByKey = new Map(fields.map((field) => [field.key, field]));

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold md:text-3xl">{t('applicationsTitle')}</h1>
      {applications.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border bg-card p-10 text-center text-muted-foreground">
          {t('applicationsEmpty')}
        </p>
      ) : (
        <ul className="flex flex-col gap-4">
          {applications.map((application) => (
            <li key={application.id} className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-lg font-semibold">{application.applicant.displayName}</h2>
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
                      const label = locale === 'hi' && field?.labelHi ? field.labelHi : field?.label ?? key;
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
              <ReviewActions
                approvePath={`admin/instructor-applications/${application.id}/approve`}
                rejectPath={`admin/instructor-applications/${application.id}/reject`}
                approveLabel={t('approve')}
                rejectLabel={t('decline')}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
