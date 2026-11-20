'use client';

import { CollaboratorSchema, ownsCourse, type Collaborator, type CollaboratorRole, type CourseRole } from '@obgyn/types';
import { Button, Input, Select, toast } from '@obgyn/ui';
import { UserPlus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useState, type FormEvent } from 'react';
import { z } from 'zod';
import { useRouter } from '@/i18n/navigation';
import { api, ApiClientError } from '@/lib/instructor-api';
import { ConfirmDialog } from '../confirm-dialog';
import { showNavigationLoader } from '@/components/layout/navigation-progress';

/**
 * Co-instructors. Owners invite faculty by email as Editor (edits content and
 * grades) or Grader (grades and sees reports), change roles and remove people;
 * co-instructors can leave.
 */
export function TeamTab({ courseId, myRole, myUserId }: { courseId: string; myRole: CourseRole; myUserId: string | null }) {
  const t = useTranslations('Teaching');
  const tCommon = useTranslations('Common');
  const router = useRouter();
  const owner = ownsCourse(myRole);
  const [rows, setRows] = useState<Collaborator[] | null>(null);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<CollaboratorRole>('EDITOR');
  const [status, setStatus] = useState<{ kind: 'ok' | 'error'; message: string } | null>(null);
  const [removing, setRemoving] = useState<Collaborator | null>(null);

  const load = () =>
    api('GET', `instructor/courses/${courseId}/collaborators`)
      .then((d) => setRows(z.array(CollaboratorSchema).parse(d)))
      .catch(() => setStatus({ kind: 'error', message: t('loadFailed') }));
  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId]);

  const fail = (e: unknown) => setStatus({ kind: 'error', message: e instanceof ApiClientError && e.messageText ? e.messageText : t('actionFailed') });

  const invite = async (event: FormEvent) => {
    event.preventDefault();
    setStatus(null);
    try {
      setRows(z.array(CollaboratorSchema).parse(await api('POST', `instructor/courses/${courseId}/collaborators`, { email, role })));
      setEmail('');
      setStatus({ kind: 'ok', message: t('invited') });
      toast.success(t('invited'));
    } catch (e) {
      fail(e);
    }
  };

  const changeRole = async (row: Collaborator, next: CollaboratorRole) => {
    try {
      setRows(z.array(CollaboratorSchema).parse(await api('PATCH', `instructor/courses/${courseId}/collaborators/${row.id}`, { role: next })));
      toast.success(tCommon('toast.saved'));
    } catch (e) {
      fail(e);
    }
  };

  const leaving = removing?.user.id === myUserId;

  return (
    <div className="flex max-w-3xl flex-col gap-5">
      <p className="text-sm text-muted-foreground">{t('teamHint')}</p>
      {owner ? (
        <form onSubmit={(e) => void invite(e)} className="flex flex-wrap items-end gap-3 rounded-xl border border-border p-4">
          <label className="flex flex-col gap-1 text-sm">
            {t('inviteEmail')}
            <Input type="email" required value={email} maxLength={254} onChange={(e) => setEmail(e.target.value)} placeholder="faculty@example.com" className="w-72" />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            {t('role')}
            <Select value={role} onChange={(e) => setRole(e.target.value as CollaboratorRole)}>
              <option value="EDITOR">{t('roles.EDITOR')}</option>
              <option value="GRADER">{t('roles.GRADER')}</option>
            </Select>
          </label>
          <Button type="submit" disabled={!email.trim()}>
            <UserPlus aria-hidden className="size-4" />
            {t('invite')}
          </Button>
          <p className="w-full text-xs text-muted-foreground">{t('inviteHint')}</p>
        </form>
      ) : null}
      {status ? (
        <p role={status.kind === 'error' ? 'alert' : 'status'} className={`text-sm ${status.kind === 'error' ? 'text-destructive' : 'text-success'}`}>
          {status.message}
        </p>
      ) : null}
      {rows === null ? (
        <p role="status" className="text-sm text-muted-foreground">{t('loading')}</p>
      ) : rows.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-primary/25 bg-primary-light/40 p-6 text-center text-muted-foreground">{t('noTeam')}</p>
      ) : (
        <ul className="flex flex-col divide-y divide-border rounded-xl border border-border">
          {rows.map((row) => (
            <li key={row.id} className="flex flex-wrap items-center gap-3 p-3 text-sm">
              <span className="min-w-0 flex-1">
                <span className="block font-medium">{row.user.displayName}</span>
                <span className="text-xs text-muted-foreground">
                  {row.user.email ?? ''} · {row.status === 'PENDING' ? t('pending') : t('accepted')}
                </span>
              </span>
              {owner ? (
                <Select aria-label={t('roleOf', { name: row.user.displayName })} value={row.role} onChange={(e) => void changeRole(row, e.target.value as CollaboratorRole)}>
                  <option value="EDITOR">{t('roles.EDITOR')}</option>
                  <option value="GRADER">{t('roles.GRADER')}</option>
                </Select>
              ) : (
                <span className="rounded bg-muted px-2 py-0.5 text-xs">{t(`roles.${row.role}`)}</span>
              )}
              {owner || row.user.id === myUserId ? (
                <Button variant="outline" size="sm" onClick={() => setRemoving(row)}>
                  {row.user.id === myUserId ? t('leave') : t('remove')}
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
      <ConfirmDialog
        open={!!removing}
        onOpenChange={(open) => !open && setRemoving(null)}
        title={leaving ? t('leaveTitle') : t('removeTitle', { name: removing?.user.displayName ?? '' })}
        body={leaving ? t('leaveBody') : t('removeBody')}
        confirmLabel={leaving ? t('leave') : t('remove')}
        onConfirm={async () => {
          if (!removing) return;
          try {
            await api('DELETE', `instructor/courses/${courseId}/collaborators/${removing.id}`);
            setRemoving(null);
            toast.success(tCommon('toast.removed'));
            if (leaving) {
              showNavigationLoader();
              router.push('/instructor/courses');
            }
            else await load();
          } catch (e) {
            fail(e);
          }
        }}
      />
    </div>
  );
}
