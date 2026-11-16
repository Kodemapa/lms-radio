import { Activity, BookOpen, Users } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';

export async function Hero({
  stats,
}: {
  stats: { courses: number; instructors: number; students: number };
}) {
  const t = await getTranslations('Home');
  const items = [
    { Icon: BookOpen, value: stats.courses, label: t('statCourses') },
    { Icon: Users, value: stats.instructors, label: t('statInstructors') },
    { Icon: Activity, value: stats.students, label: t('statStudents') },
  ];
  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-[#eeeef8] via-white to-[#f2f5f7] dark:from-[#18193a] dark:via-background dark:to-background">
      <div
        aria-hidden
        className="absolute -right-24 -top-24 size-[28rem] rounded-full bg-primary/10 blur-3xl"
      />
      <div className="container relative grid items-center gap-10 py-12 md:py-20 lg:grid-cols-[1.2fr_1fr]">
        <div className="flex flex-col gap-6">
          <p className="w-fit rounded-full bg-primary-light px-4 py-1.5 text-sm font-medium text-primary">
            {t('eyebrow')}
          </p>
          <h1 className="text-4xl font-bold leading-tight tracking-tight md:text-5xl xl:text-6xl">
            {t('title')}
          </h1>
          <p className="max-w-xl text-lg text-muted-foreground">{t('subtitle')}</p>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/courses"
              className="rounded-[4px] bg-primary px-6 py-3 font-medium text-primary-foreground transition-colors hover:bg-primary-hover md:text-lg"
            >
              {t('ctaCourses')}
            </Link>
            <Link
              href="/become-instructor"
              className="rounded-[4px] border border-secondary px-6 py-3 font-medium transition-colors hover:bg-secondary hover:text-secondary-foreground md:text-lg"
            >
              {t('ctaInstructor')}
            </Link>
          </div>
        </div>
        <ul className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1">
          {items.map(({ Icon, value, label }) => (
            <li
              key={label}
              className="flex items-center gap-4 rounded-2xl border border-border bg-card/80 p-5 shadow-sm backdrop-blur"
            >
              <span className="rounded-xl bg-primary-light p-3 text-primary">
                <Icon aria-hidden className="size-6" />
              </span>
              <span className="flex flex-col">
                <span className="text-2xl font-bold">{value.toLocaleString('en-IN')}</span>
                <span className="text-sm text-muted-foreground">{label}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
