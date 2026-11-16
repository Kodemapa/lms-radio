import { InstructorApplicationSchema } from '@obgyn/types';
import { getFormatter, getTranslations, setRequestLocale } from 'next-intl/server';
import { z } from 'zod';
import { ReviewActions } from '@/components/instructor/review-actions';
import { getMe } from '@/lib/catalog';
import { apiGet } from '@/lib/server-api';
import { requireInstructor } from '@/lib/instructor-server';

export default async function ApplicationsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  // Pages render alongside the layout, so each checks the role before calling the API.
  await requireInstructor(locale, '/instructor/applications');
  const [t, format, me] = await Promise.all([getTranslations('Instructor'), getFormatter(), getMe()]);
  if (me?.role !== 'ADMIN') return <p role="alert">{t('notAllowed')}</p>;
  const applications = await apiGet(
    '/admin/instructor-applications?status=PENDING',
    z.array(InstructorApplicationSchema),
    { auth: true },
  );

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold md:text-3xl">{t('applicationsTitle')}</h1>
      {applications.length === 0 ? (
        <p className="soft-wash rounded-3xl p-10 text-center text-muted-foreground">
          {t('applicationsEmpty')}
        </p>
      ) : (
        <ul className="flex flex-col gap-4">
          {applications.map((application) => (
            <li key={application.id} className="flex flex-col gap-3 surface p-5">
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
