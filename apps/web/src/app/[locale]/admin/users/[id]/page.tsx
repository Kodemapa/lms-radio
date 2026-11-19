import { AdminUserDetailSchema } from '@obgyn/types';
import { getFormatter, getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { z } from 'zod';
import { AdminUserActions } from '@/components/admin/user-actions';
import { Link } from '@/i18n/navigation';
import { apiGet } from '@/lib/server-api';
import { requireAdmin } from '@/lib/admin-server';

export default async function AdminUserDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const admin = await requireAdmin(locale, `/admin/users/${id}`);
  if (!z.string().uuid().safeParse(id).success) notFound();

  const [t, format, detail] = await Promise.all([
    getTranslations('Admin'),
    getFormatter(),
    apiGet(`/admin/users/${id}`, AdminUserDetailSchema, { auth: true }),
  ]);
  const { user, learning } = detail;
  const th = await getTranslations('Admin.userHistory');
  const dateTime = (iso: string) =>
    format.dateTime(new Date(iso), { dateStyle: 'medium', timeStyle: 'short' });
  const pill = (label: string, tone: 'ok' | 'warn' | 'muted' | 'bad') => (
    <span
      className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ${
        {
          ok: 'bg-green-100 text-green-900 dark:bg-green-900/40 dark:text-green-100',
          warn: 'bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-100',
          bad: 'bg-destructive/10 text-destructive',
          muted: 'bg-muted text-muted-foreground',
        }[tone]
      }`}
    >
      {label}
    </span>
  );
  const status = user.deletedAt ? 'DELETED' : user.blockedAt ? 'BLOCKED' : 'ACTIVE';

  return (
    <div className="flex flex-col gap-6">
      <Link href="/admin/users" className="w-fit text-sm font-medium text-primary hover:underline">
        ← {t('backToUsers')}
      </Link>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold md:text-3xl">{user.displayName}</h1>
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

      <section
        aria-labelledby="admin-user-profile"
        className="rounded-2xl border border-border bg-card p-5"
      >
        <h2 id="admin-user-profile" className="text-lg font-semibold">
          {t('profile')}
        </h2>
        <dl className="mt-4 grid gap-4 sm:grid-cols-2">
          <DetailItem label={t('table.email')} value={user.email ?? '—'} />
          <DetailItem label={t('table.phone')} value={user.phone ?? '—'} />
          <DetailItem label={t('headline')} value={user.headline ?? '—'} />
          <DetailItem
            label={t('learnerType')}
            value={user.learnerType ? t(`learnerTypes.${user.learnerType}`) : '—'}
          />
          <DetailItem
            label={t('joined')}
            value={format.dateTime(new Date(user.createdAt), { dateStyle: 'medium' })}
          />
          {user.blockedAt ? (
            <DetailItem
              label={t('blocked')}
              value={t('blockedDetails', {
                date: format.dateTime(new Date(user.blockedAt), { dateStyle: 'medium' }),
                admin: user.blockedByName ?? t('unknownAdmin'),
              })}
            />
          ) : null}
          {user.blockedReason ? (
            <DetailItem label={t('reason')} value={user.blockedReason} />
          ) : null}
          {user.bio ? <DetailItem label={t('bio')} value={user.bio} /> : null}
        </dl>
      </section>

      <section
        aria-labelledby="admin-user-roles"
        className="rounded-2xl border border-border bg-card p-5"
      >
        <h2 id="admin-user-roles" className="text-lg font-semibold">
          {th('roleTitle')}
        </h2>
        {detail.roleHistory.length ? (
          <ol className="mt-4 divide-y divide-border">
            {detail.roleHistory.map((entry, index) => (
              <li
                key={`${entry.at}-${index}`}
                className="flex flex-col gap-1 py-3 sm:flex-row sm:items-start sm:justify-between"
              >
                <div className="flex flex-col gap-0.5">
                  <span className="font-medium">
                    {entry.kind === 'ROLE_CHANGED'
                      ? th('roleChanged', {
                          from: entry.from ? t(`roles.${entry.from}`) : '—',
                          to: entry.to ? t(`roles.${entry.to}`) : '—',
                        })
                      : th(
                          `application.${(entry.status ?? 'PENDING') as 'PENDING' | 'APPROVED' | 'REJECTED'}`,
                        )}
                  </span>
                  {entry.note ? (
                    <span className="text-sm text-muted-foreground">
                      {th('reason', { reason: entry.note })}
                    </span>
                  ) : null}
                </div>
                <span className="shrink-0 text-sm text-muted-foreground">{dateTime(entry.at)}</span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">{th('roleEmpty')}</p>
        )}
      </section>

      <section
        aria-labelledby="admin-user-enrollments"
        className="rounded-2xl border border-border bg-card p-5"
      >
        <h2 id="admin-user-enrollments" className="text-lg font-semibold">
          {t('enrollments')}
        </h2>
        {detail.enrollments.length ? (
          <ul className="mt-4 divide-y divide-border">
            {detail.enrollments.map((enrollment) => (
              <li key={enrollment.courseId} className="flex flex-wrap justify-between gap-2 py-3">
                <Link
                  href={`/courses/${enrollment.courseSlug}`}
                  className="font-medium hover:text-primary hover:underline"
                >
                  {enrollment.courseTitle}
                </Link>
                <span className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                  <span>{th('progress', enrollment.progress)}</span>
                  {enrollment.certificateSerial
                    ? pill(th('certificate', { serial: enrollment.certificateSerial }), 'ok')
                    : null}
                  <span>
                    {format.dateTime(new Date(enrollment.enrolledAt), { dateStyle: 'medium' })}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">{t('noEnrollments')}</p>
        )}
      </section>

      <section
        aria-labelledby="admin-user-learning"
        className="flex flex-col gap-5 rounded-2xl border border-border bg-card p-5"
      >
        <div>
          <h2 id="admin-user-learning" className="text-lg font-semibold">
            {th('learningTitle')}
          </h2>
          <p className="text-sm text-muted-foreground">{th('learningIntro')}</p>
        </div>
        <HistoryList title={th('assignments')} empty={th('none')}>
          {learning.submissions.map((row, index) => (
            <HistoryRow
              key={index}
              primary={row.lessonTitle}
              secondary={row.courseTitle}
              when={dateTime(row.updatedAt)}
            >
              {pill(
                th(`submission.${row.status}`),
                row.status === 'APPROVED' ? 'ok' : row.status === 'REJECTED' ? 'warn' : 'muted',
              )}
            </HistoryRow>
          ))}
        </HistoryList>
        <HistoryList title={th('quizzes')} empty={th('none')}>
          {learning.quizAttempts.map((row, index) => (
            <HistoryRow
              key={index}
              primary={row.lessonTitle}
              secondary={row.courseTitle}
              when={dateTime(row.createdAt)}
            >
              <span className="font-semibold">{th('score', { score: row.scorePercent })}</span>
              {pill(row.passed ? th('passed') : th('failed'), row.passed ? 'ok' : 'bad')}
            </HistoryRow>
          ))}
        </HistoryList>
        <HistoryList title={th('entrance')} empty={th('none')}>
          {learning.entranceAttempts.map((row, index) => (
            <HistoryRow key={index} primary={row.courseTitle} when={dateTime(row.startedAt)}>
              {row.scorePercent !== null ? (
                <span className="font-semibold">{th('score', { score: row.scorePercent })}</span>
              ) : null}
              {pill(
                row.passed === null ? th('inProgress') : row.passed ? th('passed') : th('failed'),
                row.passed === null ? 'muted' : row.passed ? 'ok' : 'bad',
              )}
            </HistoryRow>
          ))}
        </HistoryList>
        <HistoryList title={th('reviews')} empty={th('none')}>
          {learning.reviews.map((row, index) => (
            <HistoryRow
              key={index}
              primary={row.courseTitle}
              secondary={row.comment ?? undefined}
              when={dateTime(row.createdAt)}
            >
              <span className="font-semibold">{th('stars', { rating: row.rating })}</span>
              {row.hidden
                ? pill(th('hidden'), 'bad')
                : row.reported
                  ? pill(th('reported'), 'warn')
                  : null}
            </HistoryRow>
          ))}
        </HistoryList>
      </section>

      <section
        aria-labelledby="admin-user-devices"
        className="rounded-2xl border border-border bg-card p-5"
      >
        <h2 id="admin-user-devices" className="text-lg font-semibold">
          {t('devices')}
        </h2>
        {detail.devices.length ? (
          <ul className="mt-4 divide-y divide-border">
            {detail.devices.map((device) => (
              <li key={device.id} className="flex flex-wrap justify-between gap-2 py-3">
                <span>
                  {device.label ?? t('unnamedDevice')}
                  {device.revokedAt ? (
                    <span className="ms-2 text-xs text-muted-foreground">{t('deviceRevoked')}</span>
                  ) : null}
                </span>
                <span className="text-sm text-muted-foreground">
                  {t('lastSeen', {
                    date: format.dateTime(new Date(device.lastSeenAt), { dateStyle: 'medium' }),
                  })}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">{t('noDevices')}</p>
        )}
      </section>

      <section
        aria-labelledby="admin-user-activity"
        className="rounded-2xl border border-border bg-card p-5"
      >
        <h2 id="admin-user-activity" className="text-lg font-semibold">
          {t('recentActivity')}
        </h2>
        {detail.activity.length ? (
          <ul className="mt-4 divide-y divide-border">
            {detail.activity.map((activity, index) => (
              <li
                key={`${activity.action}-${activity.createdAt}-${index}`}
                className="flex flex-wrap justify-between gap-2 py-3"
              >
                <span>
                  {activity.action} · {activity.resource}
                </span>
                <span className="text-sm text-muted-foreground">
                  {format.dateTime(new Date(activity.createdAt), {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  })}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">{t('noActivity')}</p>
        )}
      </section>
    </div>
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

function HistoryList({
  title,
  empty,
  children,
}: {
  title: string;
  empty: string;
  children: React.ReactNode[];
}) {
  return (
    <div>
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

function HistoryRow({
  primary,
  secondary,
  when,
  children,
}: {
  primary: string;
  secondary?: string;
  when: string;
  children: React.ReactNode;
}) {
  return (
    <li className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="font-medium">{primary}</p>
        {secondary ? (
          <p className="line-clamp-2 text-sm text-muted-foreground">{secondary}</p>
        ) : null}
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-3 text-sm">
        {children}
        <span className="text-muted-foreground">{when}</span>
      </div>
    </li>
  );
}
