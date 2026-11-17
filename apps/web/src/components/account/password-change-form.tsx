'use client';

import { AUTH_ERROR_CODES, ChangePasswordSchema, type ChangePassword } from '@obgyn/types';
import { Button, Input, Label } from '@obgyn/ui';
import { useTranslations } from 'next-intl';
import { useState, type FormEvent } from 'react';

export function PasswordChangeForm() {
  const t = useTranslations('Account');
  const tCommon = useTranslations('Common');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [status, setStatus] = useState<'idle' | 'saved'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setStatus('idle');
    if (newPassword !== confirmPassword) {
      setError(t('passwordErrors.mismatch'));
      return;
    }

    const parsed = ChangePasswordSchema.safeParse({
      currentPassword: currentPassword || undefined,
      newPassword,
    });
    if (!parsed.success) {
      setError(t('passwordErrors.invalid'));
      return;
    }

    setPending(true);
    try {
      const response = await fetch('/api/auth/password', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(parsed.data satisfies ChangePassword),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { code?: string } | null;
        setError(body?.code === AUTH_ERROR_CODES.wrongPassword ? t('passwordErrors.current') : tCommon('genericError'));
        return;
      }
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setStatus('saved');
    } catch {
      setError(tCommon('genericError'));
    } finally {
      setPending(false);
    }
  };

  return (
    <section aria-labelledby="change-password" className="surface flex flex-col gap-4 p-6">
      <div>
        <h2 id="change-password" className="text-lg font-semibold">{t('passwordTitle')}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t('passwordIntro')}</p>
      </div>
      <form onSubmit={submit} className="flex max-w-lg flex-col gap-4" noValidate>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="current-password">{t('currentPassword')}</Label>
          <Input
            id="current-password"
            type="password"
            autoComplete="current-password"
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="new-password">{t('newPassword')}</Label>
          <Input
            id="new-password"
            type="password"
            autoComplete="new-password"
            required
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
          />
          <p className="text-xs text-muted-foreground">{t('passwordHint')}</p>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="confirm-new-password">{t('confirmPassword')}</Label>
          <Input
            id="confirm-new-password"
            type="password"
            autoComplete="new-password"
            required
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
          />
        </div>
        {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
        {status === 'saved' ? <p role="status" className="text-sm text-success">{t('passwordSaved')}</p> : null}
        <Button type="submit" className="w-fit" disabled={pending || !newPassword || !confirmPassword}>
          {pending ? tCommon('saving') : t('changePassword')}
        </Button>
      </form>
    </section>
  );
}
