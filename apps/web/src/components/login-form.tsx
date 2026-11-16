'use client';

import { AUTH_ERROR_CODES, OtpRequestResponseSchema, OtpRequestSchema, type OtpChannel } from '@obgyn/types';
import { Button, Input, Label } from '@obgyn/ui';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useId, useState, type FormEvent } from 'react';
import { getDeviceId } from '@/lib/device';
import { safeNextPath } from '@/lib/paths';

type Step = { kind: 'password' } | { kind: 'request' } | { kind: 'verify'; challengeId: string; target: string };

/**
 * OTP sign-in. In development (`devPassword`), email + the fixed dev password
 * is shown first so testers skip the OTP round trip and its rate limit.
 */
export function LoginForm({ next, devPassword = false }: { next: string | null; devPassword?: boolean }) {
  const t = useTranslations('Login');
  const locale = useLocale();
  const router = useRouter();
  const ids = { target: useId(), code: useId(), error: useId(), hint: useId(), email: useId(), password: useId() };

  const [step, setStep] = useState<Step>(devPassword ? { kind: 'password' } : { kind: 'request' });
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [channel, setChannel] = useState<OtpChannel>('sms');
  const [target, setTarget] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function errorFor(res: Response): Promise<string> {
    if (res.status === 429) return t('errors.tooMany');
    if (res.status === 400) return t('errors.invalidInput');
    const body = (await res.json().catch(() => null)) as { code?: string } | null;
    if (body?.code === AUTH_ERROR_CODES.deviceLimit) return t('errors.deviceLimit');
    if (body?.code === AUTH_ERROR_CODES.deviceRevoked) return t('errors.deviceRevoked');
    if (res.status === 401) return step.kind === 'password' ? t('errors.invalidPassword') : t('errors.invalidCode');
    return t('errors.generic');
  }

  async function requestCode(event: FormEvent) {
    event.preventDefault();
    const payload = { channel, target: target.trim() };
    if (!OtpRequestSchema.safeParse(payload).success) {
      setError(t('errors.invalidInput'));
      return;
    }
    setPending(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/otp/request', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) return setError(await errorFor(res));
      const { challengeId } = OtpRequestResponseSchema.parse(await res.json());
      setStep({ kind: 'verify', challengeId, target: payload.target });
      setCode('');
    } catch {
      setError(t('errors.generic'));
    } finally {
      setPending(false);
    }
  }

  async function passwordLogin(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/dev-login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password, deviceId: getDeviceId(), deviceLabel: navigator.userAgent.slice(0, 100) }),
      });
      if (!res.ok) return setError(await errorFor(res));
      router.replace(safeNextPath(next, `/${locale}/courses`));
      router.refresh();
    } catch {
      setError(t('errors.generic'));
    } finally {
      setPending(false);
    }
  }

  async function verifyCode(event: FormEvent) {
    event.preventDefault();
    if (step.kind !== 'verify') return;
    setPending(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/otp/verify', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          challengeId: step.challengeId,
          code,
          deviceId: getDeviceId(),
          deviceLabel: navigator.userAgent.slice(0, 100),
        }),
      });
      if (!res.ok) return setError(await errorFor(res));
      router.replace(safeNextPath(next, `/${locale}/courses`));
      router.refresh();
    } catch {
      setError(t('errors.generic'));
    } finally {
      setPending(false);
    }
  }

  const errorBox = error ? (
    <p id={ids.error} role="alert" className="text-sm text-destructive">
      {error}
    </p>
  ) : null;

  if (step.kind === 'password') {
    return (
      <form onSubmit={passwordLogin} className="flex flex-col gap-4" noValidate>
        <div className="flex flex-col gap-2">
          <Label htmlFor={ids.email}>{t('emailLabel')}</Label>
          <Input
            id={ids.email}
            type="email"
            autoComplete="username"
            placeholder="you@example.com"
            required
            autoFocus
            value={email}
            aria-invalid={!!error}
            aria-describedby={error ? ids.error : undefined}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor={ids.password}>{t('passwordLabel')}</Label>
          <Input
            id={ids.password}
            type="password"
            autoComplete="current-password"
            required
            value={password}
            aria-invalid={!!error}
            aria-describedby={error ? ids.error : undefined}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        {errorBox}
        <Button type="submit" disabled={pending || !email.trim() || !password}>
          {pending ? t('working') : t('signIn')}
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => {
            setStep({ kind: 'request' });
            setError(null);
          }}
        >
          {t('useOtp')}
        </Button>
      </form>
    );
  }

  if (step.kind === 'verify') {
    return (
      <form onSubmit={verifyCode} className="flex flex-col gap-4" noValidate>
        <p className="text-sm">{t('codeSentTo', { target: step.target })}</p>
        <div className="flex flex-col gap-2">
          <Label htmlFor={ids.code}>{t('codeLabel')}</Label>
          <Input
            id={ids.code}
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="\d{6}"
            maxLength={6}
            required
            autoFocus
            value={code}
            aria-invalid={!!error}
            aria-describedby={error ? ids.error : undefined}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
          />
        </div>
        {errorBox}
        <Button type="submit" disabled={pending || code.length !== 6}>
          {pending ? t('working') : t('verify')}
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => {
            setStep({ kind: 'request' });
            setError(null);
          }}
        >
          {t('changeTarget')}
        </Button>
      </form>
    );
  }

  return (
    <form onSubmit={requestCode} className="flex flex-col gap-4" noValidate>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-medium">{t('channelLabel')}</legend>
        <div className="flex gap-4">
          {(['sms', 'email'] as const).map((value) => (
            <label key={value} className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="channel"
                value={value}
                checked={channel === value}
                onChange={() => {
                  setChannel(value);
                  setTarget('');
                  setError(null);
                }}
              />
              {value === 'sms' ? t('channelSms') : t('channelEmail')}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="flex flex-col gap-2">
        <Label htmlFor={ids.target}>{channel === 'sms' ? t('phoneLabel') : t('emailLabel')}</Label>
        <Input
          id={ids.target}
          type={channel === 'sms' ? 'tel' : 'email'}
          autoComplete={channel === 'sms' ? 'tel' : 'email'}
          placeholder={channel === 'sms' ? '+919876543210' : 'you@example.com'}
          required
          value={target}
          aria-invalid={!!error}
          aria-describedby={[channel === 'sms' ? ids.hint : '', error ? ids.error : ''].join(' ').trim() || undefined}
          onChange={(e) => setTarget(e.target.value)}
        />
        {channel === 'sms' ? (
          <p id={ids.hint} className="text-xs text-muted-foreground">
            {t('phoneHint')}
          </p>
        ) : null}
      </div>
      {errorBox}
      <Button type="submit" disabled={pending || !target.trim()}>
        {pending ? t('working') : t('sendCode')}
      </Button>
    </form>
  );
}
