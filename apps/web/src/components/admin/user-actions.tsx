'use client';

import { type Role } from '@obgyn/types';
import { Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, Select, Textarea } from '@obgyn/ui';
import { useTranslations } from 'next-intl';
import { type FormEvent, useState } from 'react';
import { useRouter } from '@/i18n/navigation';
import { ApiClientError, api } from '@/lib/instructor-api';
import { RequiredLabel } from './required-label';

type Action = 'block' | 'unblock' | 'role' | 'delete';

export function AdminUserActions({
  userId,
  role,
  status,
  isSelf,
}: {
  userId: string;
  role: Role;
  status: 'ACTIVE' | 'BLOCKED' | 'DELETED';
  isSelf: boolean;
}) {
  const t = useTranslations('Admin');
  const tCommon = useTranslations('Common');
  const router = useRouter();
  const [action, setAction] = useState<Action | null>(null);
  const [reason, setReason] = useState('');
  const [nextRole, setNextRole] = useState<Role>(role);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const copy = action
    ? {
        block: { title: t('actions.blockTitle'), description: t('actions.blockDescription'), submit: t('actions.block') },
        unblock: { title: t('actions.unblockTitle'), description: t('actions.unblockDescription'), submit: t('actions.unblock') },
        role: { title: t('actions.roleTitle'), description: t('actions.roleDescription'), submit: tCommon('save') },
        delete: { title: t('actions.deleteTitle'), description: t('actions.deleteDescription'), submit: t('actions.delete') },
      }[action]
    : null;

  const begin = (nextAction: Action) => {
    setReason('');
    setError(null);
    setNextRole(role);
    setAction(nextAction);
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!action || reason.trim().length < 3) return;
    setPending(true);
    setError(null);
    try {
      if (action === 'block' || action === 'unblock') {
        await api('POST', `admin/users/${userId}/${action}`, { reason: reason.trim() });
      } else if (action === 'role') {
        await api('PATCH', `admin/users/${userId}/role`, { role: nextRole, reason: reason.trim() });
      } else {
        await api('DELETE', `admin/users/${userId}`, { reason: reason.trim() });
      }
      setAction(null);
      if (action === 'delete') router.push('/admin/users');
      else router.refresh();
    } catch (requestError) {
      const code = requestError instanceof ApiClientError ? requestError.body?.code : undefined;
      setError(
        code === 'LAST_ADMIN'
          ? t('errors.lastAdmin')
          : code === 'CANNOT_MANAGE_SELF'
            ? t('errors.selfAction')
            : t('errors.actionFailed'),
      );
    } finally {
      setPending(false);
    }
  };

  if (isSelf) return <p className="text-sm text-muted-foreground">{t('selfManagementDisabled')}</p>;
  if (status === 'DELETED') return null;

  return (
    <>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={() => begin('role')}>{t('actions.changeRole')}</Button>
        {status === 'BLOCKED' ? (
          <Button variant="outline" onClick={() => begin('unblock')}>{t('actions.unblock')}</Button>
        ) : (
          <Button variant="outline" onClick={() => begin('block')}>{t('actions.block')}</Button>
        )}
        <Button variant="destructive" onClick={() => begin('delete')}>{t('actions.delete')}</Button>
      </div>
      <Dialog
        open={action !== null}
        onOpenChange={(open) => {
          if (!open && !pending) setAction(null);
        }}
      >
        {copy ? (
          <DialogContent closeLabel={tCommon('close')}>
            <form onSubmit={submit} className="flex flex-col gap-4">
              <DialogHeader>
                <DialogTitle>{copy.title}</DialogTitle>
                <DialogDescription>{copy.description}</DialogDescription>
              </DialogHeader>
              {action === 'role' ? (
                <div className="flex flex-col gap-1.5">
                  <RequiredLabel htmlFor="admin-user-role">{t('role')}</RequiredLabel>
                  <Select id="admin-user-role" required value={nextRole} onChange={(event) => setNextRole(event.target.value as Role)}>
                    <option value="LEARNER">{t('roles.LEARNER')}</option>
                    <option value="FACULTY">{t('roles.FACULTY')}</option>
                    <option value="ADMIN">{t('roles.ADMIN')}</option>
                  </Select>
                </div>
              ) : null}
              <div className="flex flex-col gap-1.5">
                <RequiredLabel htmlFor="admin-user-reason">{t('reason')}</RequiredLabel>
                <Textarea
                  id="admin-user-reason"
                  required
                  minLength={3}
                  maxLength={500}
                  rows={4}
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                />
              </div>
              {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
              <DialogFooter>
                <Button type="button" variant="outline" disabled={pending} onClick={() => setAction(null)}>
                  {tCommon('cancel')}
                </Button>
                <Button
                  type="submit"
                  variant={action === 'delete' || action === 'block' ? 'destructive' : 'default'}
                  disabled={pending || reason.trim().length < 3 || (action === 'role' && nextRole === role)}
                >
                  {pending ? t('saving') : copy.submit}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        ) : null}
      </Dialog>
    </>
  );
}
