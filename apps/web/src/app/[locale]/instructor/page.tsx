import { InstructorDashboardSchema } from '@obgyn/types';
import { Activity, ArrowRight, BookOpen, CheckCircle2, ClipboardList, Clock3, FilePen, PlayCircle, Plus, Trophy, Users } from 'lucide-react';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { CoursesTable } from '@/components/instructor/courses-table';
import { EnrolmentChart } from '@/components/instructor/teaching/enrolment-chart';
import { Invitations } from '@/components/instructor/teaching/invitations';
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
  const activity = [
    { label: t('stats.activeLearners'), value: data.activeLearners, Icon: Activity, href: null },
    { label: t('stats.completions30d'), value: data.completions30d, Icon: Trophy, href: null },
    { label: t('stats.pendingSubmissions'), value: data.pendingSubmissions, Icon: ClipboardList, href: '/instructor/submissions' as const },
  ];

  return (
    <div className="flex flex-col gap-6 lg:gap-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold md:text-3xl">{t('dashboardTitle', { name: me?.displayName ?? '' })}</h1>
          <p className="mt-1 text-muted-foreground">{t('dashboardSubtitle')}</p>
        </div>
        <Link
          href="/instructor/courses/new"
          className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
        >
          <Plus aria-hidden className="size-4" />
          {t('nav.newCourse')}
        </Link>
      </div>
      <Invitations initial={data.invitations} />
      {/* Six equal tiles: two per row on phones, three on tablets, one row on wide screens. */}
      <ul aria-label={t('statsTitle')} className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4 2xl:grid-cols-6">
        {stats.map(({ label, value, Icon }) => (
          <li key={label} className="flex min-w-0 items-center gap-3 surface p-4">
            <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary-light text-primary">
              <Icon aria-hidden className="size-5" />
            </span>
            <span className="flex min-w-0 flex-col">
              <span className="text-2xl font-bold leading-tight tabular-nums">{value.toLocaleString(locale)}</span>
              <span className="truncate text-sm text-muted-foreground" title={label}>{label}</span>
            </span>
          </li>
        ))}
      </ul>
      {/* Chart and activity share one grid row, so both columns end at the same line. */}
      <section aria-label={t('activityTitle')} className="grid gap-4 xl:grid-cols-3">
        <div className="surface p-5 xl:col-span-2">
          <EnrolmentChart data={data.enrolmentsByDay} />
        </div>
        <ul className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1 xl:grid-rows-3">
          {activity.map(({ label, value, Icon, href }) => {
            const body = (
              <>
                <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary-light text-primary">
                  <Icon aria-hidden className="size-5" />
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="text-2xl font-bold leading-tight tabular-nums">{value.toLocaleString(locale)}</span>
                  <span className="text-sm text-muted-foreground">{label}</span>
                </span>
                {href ? <ArrowRight aria-hidden className="size-4 shrink-0 text-muted-foreground rtl:rotate-180" /> : null}
              </>
            );
            const card = 'flex h-full items-center gap-3 surface p-4';
            return (
              <li key={label} className="min-w-0">
                {href ? (
                  <Link href={href} className={`${card} transition-colors hover:border-primary/50`}>{body}</Link>
                ) : (
                  <span className={card}>{body}</span>
                )}
              </li>
            );
          })}
        </ul>
      </section>
      <section aria-labelledby="recent" className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="recent" className="text-xl font-semibold">{t('recentCourses')}</h2>
          {data.recentCourses.length > 0 ? (
            <Link href="/instructor/courses" className="text-sm font-semibold text-primary hover:underline">
              {t('nav.courses')}
            </Link>
          ) : null}
        </div>
        {data.recentCourses.length > 0 ? (
          <CoursesTable courses={data.recentCourses} />
        ) : (
          <div className="flex flex-col items-center gap-4 soft-wash rounded-3xl p-10 text-center">
            <p className="text-muted-foreground">{t('noCourses')}</p>
            <Link href="/instructor/courses/new" className="rounded-full bg-primary px-5 py-2.5 font-medium text-primary-foreground">
              {t('createFirst')}
            </Link>
          </div>
        )}
      </section>
    </div>
  );
}
