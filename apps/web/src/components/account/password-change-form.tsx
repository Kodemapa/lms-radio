'use client';

import {
  AUTH_ERROR_CODES,
  ChangePasswordSchema,
  OtpRequestResponseSchema,
  PasswordChangeOtpRequestSchema,
  PASSWORD_MIN_LENGTH,
  type ChangePassword,
  type OtpChannel,
} from '@obgyn/types';
import { Button, Input, Label, toast } from '@obgyn/ui';
import { useTranslations } from 'next-intl';
import { useState, type FormEvent } from 'react';
import { RequiredLabel } from '@/components/admin/required-label';

export function PasswordChangeForm() {
  const t = useTranslations('Account');
  const tCommon = useTranslations('Common');
  const tLogin = useTranslations('Login');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [channel, setChannel] = useState<OtpChannel>('sms');
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [status, setStatus] = useState<'idle' | 'saved'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const requestCode = async () => {
    const request = PasswordChangeOtpRequestSchema.safeParse({ channel });
    if (!request.success) {
      setError(t('passwordErrors.invalid'));
      return;
    }
    setPending(true);
    setError(null);
    setStatus('idle');
    try {
      const response = await fetch('/api/auth/password/otp/request', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(request.data),
      });
      if (!response.ok) {
        setError(
          response.status === 429
            ? t('passwordErrors.tooMany')
            : response.status === 503
              ? tLogin('errors.deliveryUnavailable')
              : response.status === 400
                ? t('passwordErrors.noContact')
                : tCommon('genericError'),
        );
        return;
      }
      const challenge = OtpRequestResponseSchema.parse(await response.json());
      setChallengeId(challenge.challengeId);
      setCode('');
    } catch {
      setError(tCommon('genericError'));
    } finally {
      setPending(false);
    }
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setStatus('idle');
    const rule = !newPassword
      ? tLogin('errors.passwordRequired')
      : newPassword.length < PASSWORD_MIN_LENGTH
        ? tLogin('errors.passwordTooShort', { min: PASSWORD_MIN_LENGTH })
        : !/[A-Za-z]/.test(newPassword)
          ? tLogin('errors.passwordNeedsLetter')
          : !/d/.test(newPassword)
            ? tLogin('errors.passwordNeedsNumber')
            : null;
    if (rule) {
      setError(rule);
      return;
    }
    if (newPassword !== confirmPassword) {
      setError(t('passwordErrors.mismatch'));
      return;
    }
    if (currentPassword && currentPassword === newPassword) {
      setError(t('passwordErrors.same'));
      return;
    }

    const parsed = ChangePasswordSchema.safeParse({
      currentPassword: currentPassword || undefined,
      challengeId: challengeId || undefined,
      code: challengeId ? code : undefined,
      newPassword,
    });
    if (!parsed.success) {
      setError(
        challengeId && !/^d{6}$/.test(code)
          ? tLogin('errors.codeRequired')
          : t('passwordErrors.verificationRequired'),
      );
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
        setError(
          body?.code === AUTH_ERROR_CODES.wrongPassword
            ? t('passwordErrors.current')
            : body?.code === AUTH_ERROR_CODES.otpInvalid
              ? t('passwordErrors.codeInvalid')
              : response.status === 429
                ? t('passwordErrors.tooMany')
                : tCommon('genericError'),
        );
        return;
      }
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setChallengeId(null);
      setCode('');
      setStatus('saved');
      toast.success(tCommon('toast.passwordChanged'));
    } catch {
      setError(tCommon('genericError'));
    } finally {
      setPending(false);
    }
  };

  return (
    <section aria-labelledby="change-password" className="surface flex flex-col gap-4 p-6">
      <div>
        <h2 id="change-password" className="text-lg font-semibold">
          {t('passwordTitle')}
        </h2>
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
        <fieldset className="flex flex-col gap-2">
          <legend className="text-sm font-medium">{t('verificationMethod')}</legend>
          <div className="flex gap-4">
            {(['sms', 'email'] as const).map((value) => (
              <label key={value} className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="password-verification-channel"
                  value={value}
                  checked={channel === value}
                  onChange={() => {
                    setChannel(value);
                    setChallengeId(null);
                    setCode('');
                    setError(null);
                  }}
                />
                {value === 'sms' ? t('sms') : t('email')}
              </label>
            ))}
          </div>
          <Button
            type="button"
            variant="ghost"
            className="w-fit"
            onClick={requestCode}
            disabled={pending}
          >
            {pending ? t('sendingVerificationCode') : t('sendVerificationCode')}
          </Button>
        </fieldset>
        {challengeId ? (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="password-verification-code">{t('verificationCode')}</Label>
            <Input
              id="password-verification-code"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="\d{6}"
              maxLength={6}
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, ''))}
            />
          </div>
        ) : null}
        <div className="flex flex-col gap-1.5">
          <RequiredLabel htmlFor="new-password">{t('newPassword')}</RequiredLabel>
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
          <RequiredLabel htmlFor="confirm-new-password">{t('confirmPassword')}</RequiredLabel>
          <Input
            id="confirm-new-password"
            type="password"
            autoComplete="new-password"
            required
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
          />
        </div>
        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}
        {status === 'saved' ? (
          <p role="status" className="text-sm text-success">
            {t('passwordSaved')}
          </p>
        ) : null}
        <Button
          type="submit"
          className="w-fit"
          disabled={pending || !newPassword || !confirmPassword}
        >
          {pending ? tCommon('saving') : t('changePassword')}
        </Button>
      </form>
    </section>
  );
}
