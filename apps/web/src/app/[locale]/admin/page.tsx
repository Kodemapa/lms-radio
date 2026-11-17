import { AdminStatsSchema, COURSE_STATUSES } from '@obgyn/types';
import { getFormatter, getTranslations, setRequestLocale } from 'next-intl/server';
import { AdminDayChart } from '@/components/admin/admin-day-chart';
import { Link } from '@/i18n/navigation';
import { requireAdmin } from '@/lib/admin-server';
import { apiGet } from '@/lib/server-api';

function Tile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-2xl border border-border bg-card p-5">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-3xl font-bold tabular-nums">{value}</span>
      {hint ? <span className="text-xs text-muted-foreground">{hint}</span> : null}
    </div>
  );
}

export default async function AdminDashboardPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireAdmin(locale, '/admin');
  const [t, tAdmin, format] = await Promise.all([
    getTranslations('Admin.dashboard'),
    getTranslations('Admin'),
    getFormatter(),
  ]);
  const stats = await apiGet('/admin/stats', AdminStatsSchema, { auth: true });
  const n = (value: number) => format.number(value);

  const pending = [
    { href: '/admin/instructor-applications', label: t('pending.applications'), count: stats.pending.applications },
    { href: '/admin/courses/review', label: t('pending.courseReviews'), count: stats.pending.courseReviews },
    { href: '/admin/reviews', label: t('pending.reportedReviews'), count: stats.pending.reportedReviews },
    { href: '/admin/media?status=FAILED', label: t('pending.failedVideos'), count: stats.pending.failedVideos },
  ];

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-bold md:text-3xl">{t('title')}</h1>
        <p className="text-muted-foreground">
          {t('updated', { time: format.dateTime(new Date(stats.generatedAt), { timeStyle: 'short' }) })}
        </p>
      </div>

      <section aria-labelledby="pending-heading" className="flex flex-col gap-3">
        <h2 id="pending-heading" className="text-lg font-semibold">{t('pendingTitle')}</h2>
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {pending.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                className={`flex items-center justify-between gap-3 rounded-2xl border p-4 hover:border-primary ${
                  item.count ? 'border-amber-300 bg-amber-50 text-amber-950 dark:bg-amber-950/30 dark:text-amber-100' : 'border-border bg-card'
                }`}
              >
                <span className="font-medium">{item.label}</span>
                <span className="text-2xl font-bold tabular-nums">{n(item.count)}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="totals-heading" className="flex flex-col gap-3">
        <h2 id="totals-heading" className="text-lg font-semibold">{t('totalsTitle')}</h2>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Tile label={t('learners')} value={n(stats.users.learners)} hint={t('newUsers', { count: stats.users.newLast30Days })} />
          <Tile label={t('instructors')} value={n(stats.users.instructors)} hint={t('admins', { count: stats.users.admins })} />
          <Tile label={t('enrolments')} value={n(stats.enrolments.total)} hint={t('last30', { count: stats.enrolments.last30Days })} />
          <Tile label={t('certificates')} value={n(stats.certificates.total)} hint={t('last30', { count: stats.certificates.last30Days })} />
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {COURSE_STATUSES.map((status) => (
            <Tile key={status} label={t(`courseStatus.${status}`)} value={n(stats.courses[status] ?? 0)} />
          ))}
          <Tile label={tAdmin('statuses.BLOCKED')} value={n(stats.users.blocked)} />
        </div>
        <p className="text-sm text-muted-foreground">{t('revenueLater')}</p>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card p-5">
          <AdminDayChart data={stats.daily.enrolments} kind="enrolments" />
        </div>
        <div className="rounded-2xl border border-border bg-card p-5">
          <AdminDayChart data={stats.daily.signups} kind="signups" />
        </div>
      </section>
    </div>
  );
}
