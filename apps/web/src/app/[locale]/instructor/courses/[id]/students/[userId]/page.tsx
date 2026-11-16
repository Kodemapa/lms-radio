import { LearnerReportSchema } from '@obgyn/types';
import { ArrowLeft } from 'lucide-react';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { LearnerReportView } from '@/components/progress/learner-report';
import { Link } from '@/i18n/navigation';
import { requireInstructor } from '@/lib/instructor-server';
import { ApiError, apiGet } from '@/lib/server-api';

const UUID = /^[0-9a-f-]{36}$/i;

export default async function StudentReportPage({ params }: { params: Promise<{ locale: string; id: string; userId: string }> }) {
  const { locale, id, userId } = await params;
  setRequestLocale(locale);
  await requireInstructor(locale, `/instructor/courses/${id}`);
  if (!UUID.test(id) || !UUID.test(userId)) notFound();
  const [t, report] = await Promise.all([
    getTranslations('Report'),
    apiGet(`/instructor/courses/${id}/students/${userId}/report`, LearnerReportSchema, { auth: true }).catch((error) => {
      if (error instanceof ApiError && (error.status === 404 || error.status === 403)) notFound();
      throw error;
    }),
  ]);
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Link href={`/instructor/courses/${id}?tab=students`} className="flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-primary">
          <ArrowLeft aria-hidden className="size-4 rtl:rotate-180" />
          {t('backToStudents')}
        </Link>
        <h1 className="text-2xl font-bold md:text-3xl">{report.learner.displayName}</h1>
        <p className="text-muted-foreground">{t('instructorSubtitle', { course: report.course.title })}</p>
      </div>
      <LearnerReportView report={report} audience="instructor" />
    </div>
  );
}
