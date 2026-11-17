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
  const { user } = detail;
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
          role={user.role}
          status={status}
          isSelf={admin.id === user.id}
        />
      </div>

      <section aria-labelledby="admin-user-profile" className="rounded-2xl border border-border bg-card p-5">
        <h2 id="admin-user-profile" className="text-lg font-semibold">{t('profile')}</h2>
        <dl className="mt-4 grid gap-4 sm:grid-cols-2">
          <DetailItem label={t('table.email')} value={user.email ?? '—'} />
          <DetailItem label={t('table.phone')} value={user.phone ?? '—'} />
          <DetailItem label={t('headline')} value={user.headline ?? '—'} />
          <DetailItem label={t('learnerType')} value={user.learnerType ? t(`learnerTypes.${user.learnerType}`) : '—'} />
          <DetailItem label={t('joined')} value={format.dateTime(new Date(user.createdAt), { dateStyle: 'medium' })} />
          {user.blockedAt ? (
            <DetailItem
              label={t('blocked')}
              value={t('blockedDetails', {
                date: format.dateTime(new Date(user.blockedAt), { dateStyle: 'medium' }),
                admin: user.blockedByName ?? t('unknownAdmin'),
              })}
            />
          ) : null}
          {user.blockedReason ? <DetailItem label={t('reason')} value={user.blockedReason} /> : null}
          {user.bio ? <DetailItem label={t('bio')} value={user.bio} /> : null}
        </dl>
      </section>

      <section aria-labelledby="admin-user-enrollments" className="rounded-2xl border border-border bg-card p-5">
        <h2 id="admin-user-enrollments" className="text-lg font-semibold">{t('enrollments')}</h2>
        {detail.enrollments.length ? (
          <ul className="mt-4 divide-y divide-border">
            {detail.enrollments.map((enrollment) => (
              <li key={enrollment.courseId} className="flex flex-wrap justify-between gap-2 py-3">
                <Link href={`/courses/${enrollment.courseSlug}`} className="font-medium hover:text-primary hover:underline">
                  {enrollment.courseTitle}
                </Link>
                <span className="text-sm text-muted-foreground">
                  {format.dateTime(new Date(enrollment.enrolledAt), { dateStyle: 'medium' })}
                </span>
              </li>
            ))}
          </ul>
        ) : <p className="mt-3 text-sm text-muted-foreground">{t('noEnrollments')}</p>}
      </section>

      <section aria-labelledby="admin-user-devices" className="rounded-2xl border border-border bg-card p-5">
        <h2 id="admin-user-devices" className="text-lg font-semibold">{t('devices')}</h2>
        {detail.devices.length ? (
          <ul className="mt-4 divide-y divide-border">
            {detail.devices.map((device) => (
              <li key={device.id} className="flex flex-wrap justify-between gap-2 py-3">
                <span>
                  {device.label ?? t('unnamedDevice')}
                  {device.revokedAt ? <span className="ms-2 text-xs text-muted-foreground">{t('deviceRevoked')}</span> : null}
                </span>
                <span className="text-sm text-muted-foreground">
                  {t('lastSeen', { date: format.dateTime(new Date(device.lastSeenAt), { dateStyle: 'medium' }) })}
                </span>
              </li>
            ))}
          </ul>
        ) : <p className="mt-3 text-sm text-muted-foreground">{t('noDevices')}</p>}
      </section>

      <section aria-labelledby="admin-user-activity" className="rounded-2xl border border-border bg-card p-5">
        <h2 id="admin-user-activity" className="text-lg font-semibold">{t('recentActivity')}</h2>
        {detail.activity.length ? (
          <ul className="mt-4 divide-y divide-border">
            {detail.activity.map((activity, index) => (
              <li key={`${activity.action}-${activity.createdAt}-${index}`} className="flex flex-wrap justify-between gap-2 py-3">
                <span>{activity.action} · {activity.resource}</span>
                <span className="text-sm text-muted-foreground">
                  {format.dateTime(new Date(activity.createdAt), { dateStyle: 'medium', timeStyle: 'short' })}
                </span>
              </li>
            ))}
          </ul>
        ) : <p className="mt-3 text-sm text-muted-foreground">{t('noActivity')}</p>}
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
