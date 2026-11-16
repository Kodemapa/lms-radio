import { InstructorDashboardSchema } from '@obgyn/types';
import { BookOpen, CheckCircle2, Clock3, FilePen, PlayCircle, Users } from 'lucide-react';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { CoursesTable } from '@/components/instructor/courses-table';
import { Link } from '@/i18n/navigation';
import { getMe } from '@/lib/catalog';
import { apiGet } from '@/lib/server-api';
import { requireInstructor } from '@/lib/instructor-server';

export default async function InstructorDashboardPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  // Pages render alongside the layout, so each checks the role before calling the API.
  await requireInstructor(locale, '/instructor');
  const [t, me, data] = await Promise.all([
    getTranslations('Instructor'),
    getMe(),
    apiGet('/instructor/dashboard', InstructorDashboardSchema, { auth: true }),
  ]);

  const stats = [
    { label: t('stats.totalCourses'), value: data.totalCourses, Icon: BookOpen },
    { label: t('stats.published'), value: data.published, Icon: CheckCircle2 },
    { label: t('stats.inReview'), value: data.inReview, Icon: Clock3 },
    { label: t('stats.drafts'), value: data.drafts, Icon: FilePen },
    { label: t('stats.students'), value: data.totalStudents, Icon: Users },
    { label: t('stats.lessons'), value: data.totalLessons, Icon: PlayCircle },
  ];

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-bold md:text-3xl">{t('dashboardTitle', { name: me?.displayName ?? '' })}</h1>
        <p className="text-muted-foreground">{t('dashboardSubtitle')}</p>
      </div>
      <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {stats.map(({ label, value, Icon }) => (
          <li key={label} className="flex items-center gap-4 rounded-2xl border border-border bg-card p-5">
            <span className="rounded-xl bg-primary-light p-3 text-primary">
              <Icon aria-hidden className="size-6" />
            </span>
            <span className="flex flex-col">
              <span className="text-2xl font-bold">{value}</span>
              <span className="text-sm text-muted-foreground">{label}</span>
            </span>
          </li>
        ))}
      </ul>
      <section aria-labelledby="recent" className="flex flex-col gap-4">
        <h2 id="recent" className="text-xl font-semibold">{t('recentCourses')}</h2>
        {data.recentCourses.length > 0 ? (
          <CoursesTable courses={data.recentCourses} />
        ) : (
          <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-border bg-card p-10 text-center">
            <p className="text-muted-foreground">{t('noCourses')}</p>
            <Link href="/instructor/courses/new" className="rounded-[4px] bg-primary px-5 py-2.5 font-medium text-primary-foreground">
              {t('createFirst')}
            </Link>
          </div>
        )}
      </section>
    </div>
  );
}
