'use client';

import { type Device } from '@obgyn/types';
import { Button, Input, Label } from '@obgyn/ui';
import { Laptop } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import { useRouter as useNextRouter } from 'next/navigation';
import { useState } from 'react';
import { useRouter } from '@/i18n/navigation';
import { ApiClientError, api } from '@/lib/instructor-api';
import { ConfirmDialog } from '../instructor/confirm-dialog';

export function SecurityPanel({ devices }: { devices: Device[] }) {
  const t = useTranslations('Account');
  const tCommon = useTranslations('Common');
  const format = useFormatter();
  const router = useRouter();
  const nextRouter = useNextRouter();
  const [removing, setRemoving] = useState<Device | null>(null);
  const [confirmText, setConfirmText] = useState('');
  const [deleteState, setDeleteState] = useState<'idle' | 'pending' | 'blocked' | 'error'>('idle');

  return (
    <div className="flex flex-col gap-8">
      <section aria-labelledby="devices" className="flex flex-col gap-4 surface p-6">
        <p id="devices" className="text-sm text-muted-foreground">{t('devicesIntro')}</p>
        <ul className="divide-y divide-border">
          {devices.map((device) => (
            <li key={device.id} className="flex flex-wrap items-center gap-3 py-3">
              <Laptop aria-hidden className="size-6 text-muted-foreground" />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">
                  {device.label ?? t('unnamedDevice')}
                  {device.current ? <span className="ms-2 rounded-full bg-primary-light px-2 py-0.5 text-xs text-primary">{t('thisDevice')}</span> : null}
                </span>
                <span className="text-xs text-muted-foreground">
                  {t('lastSeen', { date: format.dateTime(new Date(device.lastSeenAt), { dateStyle: 'medium', timeStyle: 'short' }) })}
                </span>
              </span>
              {!device.current ? (
                <Button variant="outline" size="sm" onClick={() => setRemoving(device)}>{t('removeDevice')}</Button>
              ) : null}
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="delete" className="flex flex-col gap-4 rounded-2xl border border-destructive/40 bg-card p-6">
        <h2 id="delete" className="text-lg font-semibold text-destructive">{t('deleteTitle')}</h2>
        <p className="text-sm">{t('deleteBody')}</p>
        <div className="flex max-w-sm flex-col gap-2">
          <Label htmlFor="confirm-delete">{t('deleteConfirmLabel')}</Label>
          <Input id="confirm-delete" value={confirmText} autoComplete="off" onChange={(e) => setConfirmText(e.target.value)} />
        </div>
        <Button
          variant="destructive"
          className="w-fit"
          disabled={confirmText !== 'DELETE' || deleteState === 'pending'}
          onClick={async () => {
            setDeleteState('pending');
            try {
              await api('DELETE', 'users/me');
              await fetch('/api/auth/logout', { method: 'POST' });
              router.push('/');
              nextRouter.refresh();
            } catch (error) {
              setDeleteState(error instanceof ApiClientError && error.status === 409 ? 'blocked' : 'error');
            }
          }}
        >
          {t('deleteButton')}
        </Button>
        {deleteState === 'blocked' ? <p role="alert" className="text-sm text-destructive">{t('deleteBlocked')}</p> : null}
        {deleteState === 'error' ? <p role="alert" className="text-sm text-destructive">{tCommon('genericError')}</p> : null}
      </section>

      {removing ? (
        <ConfirmDialog
          open
          onOpenChange={(open) => !open && setRemoving(null)}
          title={t('removeDeviceTitle')}
          body={t('removeDeviceBody')}
          confirmLabel={t('removeDevice')}
          onConfirm={async () => {
            await api('DELETE', `users/me/devices/${removing.id}`);
            setRemoving(null);
            nextRouter.refresh();
          }}
        />
      ) : null}
    </div>
  );
}
