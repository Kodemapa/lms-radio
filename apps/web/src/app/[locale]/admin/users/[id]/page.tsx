import { AdminUserDetailSchema, type AdminUserDetail } from '@obgyn/types';
import { getFormatter, getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { type ReactNode } from 'react';
import { z } from 'zod';
import { AdminUserActions } from '@/components/admin/user-actions';
import { Link } from '@/i18n/navigation';
import { apiGet } from '@/lib/server-api';
import { requireAdmin } from '@/lib/admin-server';
import { formatDuration } from '@/lib/format';

type Tone = 'ok' | 'warn' | 'muted' | 'bad' | 'info';

const percentOf = ({ completed, total }: { completed: number; total: number }) =>
  total > 0 ? Math.min(100, Math.round((completed / total) * 100)) : 0;

export default async function AdminUserDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const admin = await requireAdmin(locale, `/admin/users/${id}`);
  if (!z.string().uuid().safeParse(id).success) notFound();

  const [t, th, format, detail] = await Promise.all([
    getTranslations('Admin'),
    getTranslations('Admin.userHistory'),
    getFormatter(),
    apiGet(`/admin/users/${id}`, AdminUserDetailSchema, { auth: true }),
  ]);
  const { user, learning, teaching } = detail;
  const dateTime = (iso: string) => format.dateTime(new Date(iso), { dateStyle: 'medium', timeStyle: 'short' });
  const date = (iso: string) => format.dateTime(new Date(iso), { dateStyle: 'medium' });
  const pill = (label: string, tone: Tone) => <Pill tone={tone}>{label}</Pill>;
  const status = user.deletedAt ? 'DELETED' : user.blockedAt ? 'BLOCKED' : 'ACTIVE';

  // Learner summary, computed from the enrolments.
  const enrolled = detail.enrollments.length;
  const completedCourses = detail.enrollments.filter((e) => e.progress.total > 0 && e.progress.completed >= e.progress.total).length;
  const averageProgress = enrolled
    ? Math.round(detail.enrollments.reduce((sum, e) => sum + percentOf(e.progress), 0) / enrolled)
    : 0;
  const certificates = detail.enrollments.filter((e) => e.certificateSerial).length;
  const learnerStats: Stat[] = [
    { label: th('stats.enrolled'), value: String(enrolled) },
    { label: th('stats.completed'), value: String(completedCourses) },
    { label: th('stats.avgProgress'), value: th('percent', { percent: averageProgress }) },
    { label: th('stats.certificates'), value: String(certificates) },
    { label: th('stats.exams'), value: String(learning.exams.length) },
    { label: th('stats.quizzes'), value: String(learning.quizAttempts.length) },
  ];

  const teachingSection = teaching ? (
    <Section id="admin-user-teaching" title={th('teachingTitle')} intro={th('teachingIntro')}>
      <StatGrid
        stats={[
          { label: th('teachingStats.courses'), value: String(teaching.totals.courses) },
          { label: th('teachingStats.published'), value: String(teaching.totals.published) },
          { label: th('teachingStats.students'), value: String(teaching.totals.students) },
          {
            label: th('teachingStats.rating'),
            value: teaching.totals.averageRating === null ? th('noValue') : `★ ${teaching.totals.averageRating}`,
            hint: teaching.totals.reviews ? `${teaching.totals.reviews} ${th('teachingStats.reviews').toLowerCase()}` : undefined,
          },
          { label: th('teachingStats.pending'), value: String(teaching.totals.pendingGrading) },
          { label: th('teachingStats.certificates'), value: String(teaching.totals.certificates) },
        ]}
      />

      <SubHeading title={th('coursesTaught')} count={teaching.courses.length} />
      {teaching.courses.length ? (
        <ul className="grid gap-3 md:grid-cols-2">
          {teaching.courses.map((course) => (
            <li key={course.id} className="flex min-w-0 flex-col gap-2 rounded-xl border border-border p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                {course.status === 'PUBLISHED' ? (
                  <Link href={`/courses/${course.slug}`} className="min-w-0 break-words font-semibold hover:text-primary hover:underline">
                    {course.title}
                  </Link>
                ) : (
                  <span className="min-w-0 break-words font-semibold">{course.title}</span>
                )}
                <span className="flex flex-wrap gap-1.5">
                  {pill(th(`courseStatus.${course.status}`), course.status === 'PUBLISHED' ? 'ok' : course.status === 'IN_REVIEW' ? 'warn' : 'muted')}
                  {pill(th(`courseRole.${course.role}`), 'info')}
                </span>
              </div>
              <p className="text-sm text-muted-foreground">
                {th('courseCounts', { students: course.students, lessons: course.lessons, certificates: course.certificates })}
              </p>
              <p className="text-sm">
                {course.averageRating === null ? (
                  <span className="text-muted-foreground">{th('noRatings')}</span>
                ) : (
                  th('rating', { rating: course.averageRating, count: course.reviews })
                )}
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">{th('noCourses')}</p>
      )}

      <SubHeading title={th('recentStudents')} count={teaching.students.length} hint={teaching.students.length ? th('recentStudentsIntro') : undefined} />
      {teaching.students.length ? (
        <ul className="divide-y divide-border rounded-xl border border-border">
          {teaching.students.map((student) => (
            <li
              key={`${student.userId}-${student.courseTitle}-${student.enrolledAt}`}
              className="grid gap-2 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_12rem] sm:items-center sm:gap-4"
            >
              <div className="min-w-0">
                <Link href={`/admin/users/${student.userId}`} className="font-medium hover:text-primary hover:underline">
                  {student.displayName}
                </Link>
                <p className="truncate text-sm text-muted-foreground">
                  {student.courseTitle} · {th('enrolledOn', { date: date(student.enrolledAt) })}
                </p>
              </div>
              <ProgressBar
                percent={percentOf(student.progress)}
                label={th('progress', student.progress)}
              />
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">{th('noStudents')}</p>
      )}
    </Section>
  ) : null;

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <Link href="/admin/users" className="w-fit text-sm font-medium text-primary hover:underline">
        ← {t('backToUsers')}
      </Link>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="break-words text-2xl font-bold md:text-3xl">{user.displayName}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t('roles.' + user.role)} · {t('statuses.' + status)}
          </p>
        </div>
        <AdminUserActions
          userId={user.id}
          userName={user.displayName}
          role={user.role}
          status={status}
          isSelf={admin.id === user.id}
          showView={false}
          afterDelete="list"
        />
      </div>

      <Section id="admin-user-summary" title={th('summaryTitle')}>
        <StatGrid stats={learnerStats} />
      </Section>

      <Section id="admin-user-profile" title={t('profile')}>
        <dl className="grid gap-4 sm:grid-cols-2">
          <DetailItem label={t('table.email')} value={user.email ?? '—'} />
          <DetailItem label={t('table.phone')} value={user.phone ?? '—'} />
          <DetailItem label={t('headline')} value={user.headline ?? '—'} />
          <DetailItem label={t('learnerType')} value={user.learnerType ? t(`learnerTypes.${user.learnerType}`) : '—'} />
          <DetailItem label={t('joined')} value={date(user.createdAt)} />
          {user.blockedAt ? (
            <DetailItem
              label={t('blocked')}
              value={t('blockedDetails', { date: date(user.blockedAt), admin: user.blockedByName ?? t('unknownAdmin') })}
            />
          ) : null}
          {user.blockedReason ? <DetailItem label={t('reason')} value={user.blockedReason} /> : null}
          {user.bio ? <DetailItem label={t('bio')} value={user.bio} /> : null}
        </dl>
      </Section>

      {/* Instructors and admins: what they teach comes first. */}
      {user.role !== 'LEARNER' ? teachingSection : null}

      <Section id="admin-user-enrollments" title={t('enrollments')}>
        {detail.enrollments.length ? (
          <ul className="divide-y divide-border rounded-xl border border-border">
            {detail.enrollments.map((enrollment) => (
              <li
                key={enrollment.courseId}
                className="grid gap-3 px-4 py-4 md:grid-cols-[minmax(0,1fr)_14rem] md:items-center md:gap-6"
              >
                <div className="flex min-w-0 flex-col gap-1">
                  <Link href={`/courses/${enrollment.courseSlug}`} className="break-words font-semibold hover:text-primary hover:underline">
                    {enrollment.courseTitle}
                  </Link>
                  <p className="text-sm">
                    {enrollment.instructorId && enrollment.instructorName ? (
                      <Link href={`/admin/users/${enrollment.instructorId}`} className="text-primary hover:underline">
                        {th('instructor', { name: enrollment.instructorName })}
                      </Link>
                    ) : (
                      <span className="text-muted-foreground">{th('noInstructor')}</span>
                    )}
                  </p>
                  <p className="flex flex-wrap gap-x-3 gap-y-1 text-sm text-muted-foreground">
                    <span>{th('enrolledOn', { date: date(enrollment.enrolledAt) })}</span>
                    <span>
                      {enrollment.lastActivityAt
                        ? th('lastActive', { date: dateTime(enrollment.lastActivityAt) })
                        : th('notStarted')}
                    </span>
                    {enrollment.watchedSec > 0 ? (
                      <span>{th('watched', { time: formatDuration(enrollment.watchedSec) })}</span>
                    ) : null}
                  </p>
                  {enrollment.certificateSerial ? (
                    <span>{pill(th('certificate', { serial: enrollment.certificateSerial }), 'ok')}</span>
                  ) : null}
                </div>
                <ProgressBar percent={percentOf(enrollment.progress)} label={th('progress', enrollment.progress)} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">{t('noEnrollments')}</p>
        )}
      </Section>

      <Section id="admin-user-learning" title={th('learningTitle')} intro={th('learningIntro')}>
        <HistoryList title={th('exams')} empty={th('none')}>
          {learning.exams.map((row, index) => (
            <HistoryRow key={index} primary={row.lessonTitle} secondary={row.courseTitle} when={dateTime(row.submittedAt ?? row.startedAt)}>
              {row.scorePercent !== null ? <span className="font-semibold">{th('score', { score: row.scorePercent })}</span> : null}
              {row.passed !== null ? pill(row.passed ? th('passed') : th('failed'), row.passed ? 'ok' : 'bad') : null}
              {pill(th(`examStatus.${row.status}`), row.status === 'IN_PROGRESS' ? 'muted' : row.status === 'SUBMITTED' ? 'info' : 'warn')}
              {pill(th(`examReview.${row.reviewStatus}`), row.reviewStatus === 'CLEARED' ? 'ok' : row.reviewStatus === 'FLAGGED' ? 'bad' : 'muted')}
            </HistoryRow>
          ))}
        </HistoryList>
        <HistoryList title={th('quizzes')} empty={th('none')}>
          {learning.quizAttempts.map((row, index) => (
            <HistoryRow key={index} primary={row.lessonTitle} secondary={row.courseTitle} when={dateTime(row.createdAt)}>
              <span className="font-semibold">{th('score', { score: row.scorePercent })}</span>
              {pill(row.passed ? th('passed') : th('failed'), row.passed ? 'ok' : 'bad')}
            </HistoryRow>
          ))}
        </HistoryList>
        <HistoryList title={th('imaging')} empty={th('none')}>
          {learning.imagingAttempts.map((row, index) => (
            <HistoryRow key={index} primary={row.lessonTitle} secondary={row.courseTitle} when={dateTime(row.createdAt)}>
              <span className="font-semibold">{th('score', { score: row.scorePercent })}</span>
              {pill(row.passed ? th('passed') : th('failed'), row.passed ? 'ok' : 'bad')}
            </HistoryRow>
          ))}
        </HistoryList>
        <HistoryList title={th('entrance')} empty={th('none')}>
          {learning.entranceAttempts.map((row, index) => (
            <HistoryRow key={index} primary={row.courseTitle} when={dateTime(row.startedAt)}>
              {row.scorePercent !== null ? <span className="font-semibold">{th('score', { score: row.scorePercent })}</span> : null}
              {pill(
                row.passed === null ? th('inProgress') : row.passed ? th('passed') : th('failed'),
                row.passed === null ? 'muted' : row.passed ? 'ok' : 'bad',
              )}
            </HistoryRow>
          ))}
        </HistoryList>
        <HistoryList title={th('assignments')} empty={th('none')}>
          {learning.submissions.map((row, index) => (
            <HistoryRow key={index} primary={row.lessonTitle} secondary={row.courseTitle} when={dateTime(row.updatedAt)}>
              {pill(th(`submission.${row.status}`), row.status === 'APPROVED' ? 'ok' : row.status === 'REJECTED' ? 'warn' : 'muted')}
            </HistoryRow>
          ))}
        </HistoryList>
        <HistoryList title={th('reviews')} empty={th('none')}>
          {learning.reviews.map((row, index) => (
            <HistoryRow key={index} primary={row.courseTitle} secondary={row.comment ?? undefined} when={dateTime(row.createdAt)}>
              <span className="font-semibold">{th('stars', { rating: row.rating })}</span>
              {row.hidden ? pill(th('hidden'), 'bad') : row.reported ? pill(th('reported'), 'warn') : null}
            </HistoryRow>
          ))}
        </HistoryList>
      </Section>

      {/* A learner who used to teach keeps that record, after their learning. */}
      {user.role === 'LEARNER' ? teachingSection : null}

      <Section id="admin-user-roles" title={th('roleTitle')}>
        {detail.roleHistory.length ? (
          <ol className="divide-y divide-border">
            {detail.roleHistory.map((entry, index) => (
              <li key={`${entry.at}-${index}`} className="flex flex-col gap-1 py-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex flex-col gap-0.5">
                  <span className="font-medium">
                    {entry.kind === 'ROLE_CHANGED'
                      ? th('roleChanged', {
                          from: entry.from ? t(`roles.${entry.from}`) : '—',
                          to: entry.to ? t(`roles.${entry.to}`) : '—',
                        })
                      : th(`application.${(entry.status ?? 'PENDING') as 'PENDING' | 'APPROVED' | 'REJECTED'}`)}
                  </span>
                  {entry.note ? <span className="text-sm text-muted-foreground">{th('reason', { reason: entry.note })}</span> : null}
                </div>
                <span className="shrink-0 text-sm text-muted-foreground">{dateTime(entry.at)}</span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-sm text-muted-foreground">{th('roleEmpty')}</p>
        )}
      </Section>

      <Section id="admin-user-devices" title={t('devices')}>
        {detail.devices.length ? (
          <ul className="divide-y divide-border">
            {detail.devices.map((device) => (
              <li key={device.id} className="flex flex-wrap justify-between gap-2 py-3">
                <span className="min-w-0 break-words">
                  {device.label ?? t('unnamedDevice')}
                  {device.revokedAt ? <span className="ms-2 text-xs text-muted-foreground">{t('deviceRevoked')}</span> : null}
                </span>
                <span className="text-sm text-muted-foreground">{t('lastSeen', { date: date(device.lastSeenAt) })}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">{t('noDevices')}</p>
        )}
      </Section>

      <Section id="admin-user-activity" title={t('recentActivity')}>
        {detail.activity.length ? (
          <ul className="divide-y divide-border">
            {detail.activity.map((activity, index) => (
              <li key={`${activity.action}-${activity.createdAt}-${index}`} className="flex flex-wrap justify-between gap-2 py-3">
                <span className="min-w-0 break-words">
                  {activity.action} · {activity.resource}
                </span>
                <span className="text-sm text-muted-foreground">{dateTime(activity.createdAt)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">{t('noActivity')}</p>
        )}
      </Section>
    </div>
  );
}

type Stat = { label: string; value: string; hint?: string };

function Section({ id, title, intro, children }: { id: string; title: string; intro?: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="flex min-w-0 flex-col gap-4 rounded-2xl border border-border bg-card p-4 sm:p-5">
      <div>
        <h2 id={id} className="text-lg font-semibold">{title}</h2>
        {intro ? <p className="text-sm text-muted-foreground">{intro}</p> : null}
      </div>
      {children}
    </section>
  );
}

function StatGrid({ stats }: { stats: Stat[] }) {
  return (
    <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
      {stats.map((stat) => (
        <div key={stat.label} className="min-w-0 rounded-xl bg-muted/50 p-3">
          <dt className="text-xs font-medium text-muted-foreground">{stat.label}</dt>
          <dd className="mt-1 text-xl font-bold tabular-nums">{stat.value}</dd>
          {stat.hint ? <dd className="text-xs text-muted-foreground">{stat.hint}</dd> : null}
        </div>
      ))}
    </dl>
  );
}

function SubHeading({ title, count, hint }: { title: string; count: number; hint?: string }) {
  return (
    <div className="-mb-1">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        {title} <span className="font-normal">({count})</span>
      </h3>
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function ProgressBar({ percent, label }: { percent: number; label: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-2 text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-semibold tabular-nums">{percent}%</span>
      </div>
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        aria-label={label}
        className="h-2 overflow-hidden rounded-full bg-muted"
      >
        <div className={`h-full rounded-full ${percent >= 100 ? 'bg-accent' : 'bg-primary'}`} style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

function Pill({ tone, children }: { tone: Tone; children: ReactNode }) {
  return (
    <span
      className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ${
        {
          ok: 'bg-green-100 text-green-900 dark:bg-green-900/40 dark:text-green-100',
          warn: 'bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-100',
          bad: 'bg-destructive/10 text-destructive',
          muted: 'bg-muted text-muted-foreground',
          info: 'bg-primary-light text-primary',
        }[tone]
      }`}
    >
      {children}
    </span>
  );
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="mt-1 whitespace-pre-line break-words font-medium">{value}</dd>
    </div>
  );
}

function HistoryList({ title, empty, children }: { title: string; empty: string; children: ReactNode[] }) {
  return (
    <div className="min-w-0">
      <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        {title} <span className="font-normal">({children.length})</span>
      </h3>
      {children.length ? (
        <ul className="divide-y divide-border rounded-xl border border-border">{children}</ul>
      ) : (
        <p className="text-sm text-muted-foreground">{empty}</p>
      )}
    </div>
  );
}

function HistoryRow({ primary, secondary, when, children }: { primary: string; secondary?: string; when: string; children: ReactNode }) {
  return (
    <li className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="break-words font-medium">{primary}</p>
        {secondary ? <p className="line-clamp-2 text-sm text-muted-foreground">{secondary}</p> : null}
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-2 text-sm sm:justify-end">
        {children}
        <span className="text-muted-foreground">{when}</span>
      </div>
    </li>
  );
}

export type { AdminUserDetail };
