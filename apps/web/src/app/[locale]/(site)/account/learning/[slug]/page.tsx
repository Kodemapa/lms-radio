import { LearnerReportSchema } from '@obgyn/types';
import { ArrowLeft } from 'lucide-react';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { LearnerReportView } from '@/components/progress/learner-report';
import { Link } from '@/i18n/navigation';
import { ApiError, apiGet } from '@/lib/server-api';

export default async function MyProgressReportPage({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  if (!/^[a-z0-9-]{1,200}$/.test(slug)) notFound();
  const [t, report] = await Promise.all([
    getTranslations('Report'),
    apiGet(`/learn/courses/${slug}/report`, LearnerReportSchema, { auth: true }).catch((error) => {
      if (error instanceof ApiError && (error.status === 404 || error.status === 403)) notFound();
      throw error;
    }),
  ]);
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Link href="/account/learning" className="flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-primary">
          <ArrowLeft aria-hidden className="size-4 rtl:rotate-180" />
          {t('backToLearning')}
        </Link>
        <h1 className="text-2xl font-bold md:text-3xl">{t('myTitle')}</h1>
        <p className="text-muted-foreground">{report.course.title}</p>
      </div>
      <LearnerReportView report={report} audience="learner" />
    </div>
  );
}
