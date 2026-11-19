'use client';

import { type Role } from '@obgyn/types';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Select,
  Textarea,
  toast,
} from '@obgyn/ui';
import { Eye, Pencil, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { type FormEvent, useState } from 'react';
import { Link, useRouter } from '@/i18n/navigation';
import { ApiClientError, api } from '@/lib/instructor-api';
import { RequiredLabel } from './required-label';

type Status = 'ACTIVE' | 'BLOCKED' | 'DELETED';
/** Edit covers the role change and block/unblock; delete is its own icon. */
type EditChoice = 'role' | 'block' | 'unblock';
type Open = { kind: 'edit'; choice: EditChoice } | { kind: 'delete' } | null;

const iconButton =
  'inline-flex size-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-primary-light hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-40';

/**
 * Icon-only View / Edit / Delete actions for one user, used in the Users table
 * and on the user page. Every action asks for a reason and is audit-logged by the API.
 */
export function AdminUserActions({
  userId,
  userName,
  role,
  status,
  isSelf,
  showView = true,
  afterDelete = 'refresh',
  onChanged,
}: {
  userId: string;
  userName: string;
  role: Role;
  status: Status;
  isSelf: boolean;
  showView?: boolean;
  /** On the user page a deleted user's page is gone, so go back to the list. */
  afterDelete?: 'refresh' | 'list';
  /** Called after a successful change instead of refreshing the page (the live users table reloads itself). */
  onChanged?: () => void;
}) {
  const t = useTranslations('Admin');
  const tCommon = useTranslations('Common');
  const router = useRouter();
  const [open, setOpen] = useState<Open>(null);
  const [reason, setReason] = useState('');
  const [nextRole, setNextRole] = useState<Role>(role);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const blockChoice: EditChoice = status === 'BLOCKED' ? 'unblock' : 'block';
  const canManage = !isSelf && status !== 'DELETED';
  const disabledHint = isSelf ? t('selfManagementDisabled') : undefined;

  const start = (next: Open) => {
    setReason('');
    setError(null);
    setNextRole(role);
    setOpen(next);
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!open || reason.trim().length < 3) return;
    setPending(true);
    setError(null);
    try {
      const body = { reason: reason.trim() };
      if (open.kind === 'delete') {
        await api('DELETE', `admin/users/${userId}`, body);
      } else if (open.choice === 'role') {
        await api('PATCH', `admin/users/${userId}/role`, { ...body, role: nextRole });
      } else {
        await api('POST', `admin/users/${userId}/${open.choice}`, body);
      }
      const deleted = open.kind === 'delete';
      toast.success(t(`toast.${deleted ? 'deleted' : open.choice}`));
      setOpen(null);
      if (deleted && afterDelete === 'list') router.push('/admin/users');
      else if (onChanged) onChanged();
      else router.refresh();
    } catch (requestError) {
      const code = requestError instanceof ApiClientError ? requestError.body?.code : undefined;
      setError(
        code === 'LAST_ADMIN'
          ? t('errors.lastAdmin')
          : code === 'CANNOT_MANAGE_SELF'
            ? t('errors.selfAction')
            : code === 'HAS_PUBLISHED_COURSES'
              ? t('errors.hasPublishedCourses')
              : t('errors.actionFailed'),
      );
    } finally {
      setPending(false);
    }
  };

  const isEdit = open?.kind === 'edit';
  const choice = isEdit ? open.choice : null;
  const destructive = open?.kind === 'delete' || choice === 'block';
  const copy =
    open?.kind === 'delete'
      ? { title: t('actions.deleteTitle'), description: t('actions.deleteDescription'), submit: t('actions.delete') }
      : choice === 'role'
        ? { title: t('actions.roleTitle'), description: t('actions.roleDescription'), submit: tCommon('save') }
        : choice === 'block'
          ? { title: t('actions.blockTitle'), description: t('actions.blockDescription'), submit: t('actions.block') }
          : { title: t('actions.unblockTitle'), description: t('actions.unblockDescription'), submit: t('actions.unblock') };

  return (
    <>
      <div className="flex items-center gap-1">
        {showView ? (
          <Link
            href={`/admin/users/${userId}`}
            className={iconButton}
            aria-label={t('actions.viewUser', { name: userName })}
            title={t('actions.view')}
          >
            <Eye aria-hidden className="size-4" />
          </Link>
        ) : null}
        <button
          type="button"
          className={iconButton}
          disabled={!canManage}
          aria-label={t('actions.editUser', { name: userName })}
          title={disabledHint ?? t('actions.edit')}
          onClick={() => start({ kind: 'edit', choice: 'role' })}
        >
          <Pencil aria-hidden className="size-4" />
        </button>
        <button
          type="button"
          className={`${iconButton} hover:bg-destructive/10 hover:text-destructive`}
          disabled={!canManage}
          aria-label={t('actions.deleteUser', { name: userName })}
          title={disabledHint ?? t('actions.delete')}
          onClick={() => start({ kind: 'delete' })}
        >
          <Trash2 aria-hidden className="size-4" />
        </button>
      </div>

      <Dialog
        open={open !== null}
        onOpenChange={(value) => {
          if (!value && !pending) setOpen(null);
        }}
      >
        {open ? (
          <DialogContent closeLabel={tCommon('close')}>
            <form onSubmit={submit} className="flex flex-col gap-4">
              <DialogHeader>
                <DialogTitle>{isEdit ? t('actions.editTitle', { name: userName }) : copy.title}</DialogTitle>
                <DialogDescription>{copy.description}</DialogDescription>
              </DialogHeader>

              {isEdit ? (
                <fieldset className="flex flex-col gap-2">
                  <legend className="mb-1 text-sm font-medium">{t('actions.whatToChange')}</legend>
                  <div className="flex flex-wrap gap-2">
                    {(['role', blockChoice] as const).map((value) => (
                      <label
                        key={value}
                        className={`flex cursor-pointer items-center gap-2 rounded-full border px-4 py-2 text-sm transition-colors ${
                          choice === value
                            ? 'border-primary bg-primary-light text-primary'
                            : 'border-border hover:bg-muted'
                        }`}
                      >
                        <input
                          type="radio"
                          name={`admin-edit-${userId}`}
                          value={value}
                          className="sr-only"
                          checked={choice === value}
                          onChange={() => {
                            setError(null);
                            setOpen({ kind: 'edit', choice: value });
                          }}
                        />
                        {value === 'role'
                          ? t('actions.changeRole')
                          : value === 'block'
                            ? t('actions.block')
                            : t('actions.unblock')}
                      </label>
                    ))}
                  </div>
                </fieldset>
              ) : null}

              {choice === 'role' ? (
                <div className="flex flex-col gap-1.5">
                  <RequiredLabel htmlFor={`admin-user-role-${userId}`}>{t('role')}</RequiredLabel>
                  <Select
                    id={`admin-user-role-${userId}`}
                    required
                    value={nextRole}
                    onChange={(event) => setNextRole(event.target.value as Role)}
                  >
                    <option value="LEARNER">{t('roles.LEARNER')}</option>
                    <option value="FACULTY">{t('roles.FACULTY')}</option>
                    <option value="ADMIN">{t('roles.ADMIN')}</option>
                  </Select>
                </div>
              ) : null}

              <div className="flex flex-col gap-1.5">
                <RequiredLabel htmlFor={`admin-user-reason-${userId}`}>{t('reason')}</RequiredLabel>
                <Textarea
                  id={`admin-user-reason-${userId}`}
                  required
                  minLength={3}
                  maxLength={500}
                  rows={4}
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                />
              </div>
              {error ? (
                <p role="alert" className="text-sm text-destructive">
                  {error}
                </p>
              ) : null}
              <DialogFooter>
                <Button type="button" variant="outline" disabled={pending} onClick={() => setOpen(null)}>
                  {tCommon('cancel')}
                </Button>
                <Button
                  type="submit"
                  variant={destructive ? 'destructive' : 'default'}
                  disabled={pending || reason.trim().length < 3 || (choice === 'role' && nextRole === role)}
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
