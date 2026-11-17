'use client';

import {
  AUTH_ERROR_CODES,
  OtpRequestResponseSchema,
  OtpRequestSchema,
  PasswordSchema,
  SignupSchema,
  UserProfileSchema,
  type OtpChannel,
} from '@obgyn/types';
import { Button, Input, Label } from '@obgyn/ui';
import { Eye, EyeOff } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useId, useState, type FormEvent } from 'react';
import { getDeviceId } from '@/lib/device';
import { safeNextPath } from '@/lib/paths';

type Step =
  | { kind: 'password' }
  | { kind: 'otp-request' }
  | { kind: 'otp-verify'; challengeId: string; target: string }
  | { kind: 'signup' }
  | { kind: 'signup-verify'; challengeId: string; target: string };

export function LoginForm({ next, register = false }: { next: string | null; register?: boolean }) {
  const t = useTranslations('Login');
  const locale = useLocale();
  const router = useRouter();
  const ids = {
    target: useId(),
    code: useId(),
    error: useId(),
    hint: useId(),
    email: useId(),
    password: useId(),
    name: useId(),
    phone: useId(),
    confirmPassword: useId(),
    terms: useId(),
  };

  const [step, setStep] = useState<Step>(register ? { kind: 'signup' } : { kind: 'otp-request' });
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [channel, setChannel] = useState<OtpChannel>('sms');
  const [target, setTarget] = useState('');
  const [code, setCode] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [phone, setPhone] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function errorFor(res: Response): Promise<string> {
    if (res.status === 429) return t('errors.tooMany');
    const body = (await res.json().catch(() => null)) as { code?: string } | null;
    if (body?.code === AUTH_ERROR_CODES.deviceLimit) return t('errors.deviceLimit');
    if (body?.code === AUTH_ERROR_CODES.deviceRevoked) return t('errors.deviceRevoked');
    if (body?.code === AUTH_ERROR_CODES.accountBlocked) return t('errors.accountBlocked');
    if (body?.code === AUTH_ERROR_CODES.accountExists) return t('errors.accountExists');
    if (body?.code === AUTH_ERROR_CODES.noAccount) return t('errors.noAccount');
    if (body?.code === AUTH_ERROR_CODES.invalidCredentials) return t('errors.invalidPassword');
    if (res.status === 400) return t('errors.invalidInput');
    if (res.status === 401) return t('errors.invalidCode');
    return t('errors.generic');
  }

  async function continueAfterAuthentication(roleOverride?: 'LEARNER' | 'FACULTY' | 'ADMIN') {
    if (roleOverride) {
      router.replace(`/${locale}/courses`);
    } else if (next) {
      router.replace(safeNextPath(next, `/${locale}/courses`));
    } else {
      const res = await fetch('/api/proxy/users/me', { cache: 'no-store' });
      if (!res.ok) throw new Error(t('errors.generic'));
      const profile = UserProfileSchema.parse(await res.json());
      const destination =
        profile.role === 'ADMIN'
          ? `/${locale}/admin`
          : profile.role === 'FACULTY'
            ? `/${locale}/instructor`
            : `/${locale}/courses`;
      router.replace(destination);
    }
    router.refresh();
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
      setStep({ kind: 'otp-verify', challengeId, target: payload.target });
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
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          password,
          deviceId: getDeviceId(),
          deviceLabel: navigator.userAgent.slice(0, 100),
        }),
      });
      if (!res.ok) return setError(await errorFor(res));
      await continueAfterAuthentication();
    } catch {
      setError(t('errors.generic'));
    } finally {
      setPending(false);
    }
  }

  async function verifyCode(event: FormEvent) {
    event.preventDefault();
    if (step.kind !== 'otp-verify') return;
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
      await continueAfterAuthentication();
    } catch {
      setError(t('errors.generic'));
    } finally {
      setPending(false);
    }
  }

  async function requestSignupCode(event: FormEvent) {
    event.preventDefault();
    setError(null);
    const emailRequest = OtpRequestSchema.safeParse({ channel: 'email', target: email.trim() });
    const passwordResult = PasswordSchema.safeParse(password);
    if (displayName.trim().length < 2 || !emailRequest.success || !passwordResult.success) {
      setError(t('errors.invalidInput'));
      return;
    }
    if (password !== confirmPassword) {
      setError(t('errors.passwordMismatch'));
      return;
    }
    if (!acceptTerms) {
      setError(t('errors.termsRequired'));
      return;
    }

    setPending(true);
    try {
      const res = await fetch('/api/auth/otp/request', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(emailRequest.data),
      });
      if (!res.ok) return setError(await errorFor(res));
      const { challengeId } = OtpRequestResponseSchema.parse(await res.json());
      setStep({ kind: 'signup-verify', challengeId, target: emailRequest.data.target });
      setCode('');
    } catch {
      setError(t('errors.generic'));
    } finally {
      setPending(false);
    }
  }

  async function finishSignup(event: FormEvent) {
    event.preventDefault();
    if (step.kind !== 'signup-verify') return;
    const parsed = SignupSchema.safeParse({
      displayName,
      email,
      phone,
      password,
      challengeId: step.challengeId,
      code,
      acceptTerms,
      deviceId: getDeviceId(),
      deviceLabel: navigator.userAgent.slice(0, 100),
    });
    if (!parsed.success) {
      setError(t('errors.invalidInput'));
      return;
    }
    setPending(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(parsed.data),
      });
      if (!res.ok) return setError(await errorFor(res));
      await continueAfterAuthentication('LEARNER');
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
          <div className="relative">
            <Input
              id={ids.password}
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              required
              className="pe-11"
              value={password}
              aria-invalid={!!error}
              aria-describedby={error ? ids.error : undefined}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button
              type="button"
              className="absolute inset-y-0 end-0 flex w-11 items-center justify-center rounded-e-md text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label={showPassword ? t('hidePassword') : t('showPassword')}
              aria-pressed={showPassword}
              aria-controls={ids.password}
              onClick={() => setShowPassword((value) => !value)}
            >
              {showPassword ? <EyeOff aria-hidden className="size-4" /> : <Eye aria-hidden className="size-4" />}
            </button>
          </div>
        </div>
        {errorBox}
        <Button type="submit" disabled={pending || !email.trim() || !password}>
          {pending ? t('working') : t('signIn')}
        </Button>
        <Button type="button" variant="ghost" onClick={() => { setStep({ kind: 'otp-request' }); setError(null); }}>
          {t('useOtp')}
        </Button>
      </form>
    );
  }

  if (step.kind === 'otp-verify') {
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
        <Button type="button" variant="ghost" onClick={() => { setStep({ kind: 'otp-request' }); setError(null); }}>
          {t('changeTarget')}
        </Button>
      </form>
    );
  }

  if (step.kind === 'signup') {
    return (
      <form onSubmit={requestSignupCode} className="flex flex-col gap-4" noValidate>
        <div className="flex flex-col gap-2">
          <Label htmlFor={ids.name}>{t('nameLabel')}</Label>
          <Input id={ids.name} autoComplete="name" required maxLength={100} value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor={ids.email}>{t('emailLabel')}</Label>
          <Input id={ids.email} type="email" autoComplete="email" required maxLength={254} value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor={ids.phone}>{t('phoneOptional')}</Label>
          <Input id={ids.phone} type="tel" autoComplete="tel" placeholder="+919876543210" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor={ids.password}>{t('passwordLabel')}</Label>
          <Input id={ids.password} type="password" autoComplete="new-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          <p className="text-xs text-muted-foreground">{t('passwordHint')}</p>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor={ids.confirmPassword}>{t('confirmPassword')}</Label>
          <Input id={ids.confirmPassword} type="password" autoComplete="new-password" required value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
        </div>
        <label htmlFor={ids.terms} className="flex items-start gap-2 text-sm">
          <input id={ids.terms} type="checkbox" className="mt-1 size-4" checked={acceptTerms} onChange={(e) => setAcceptTerms(e.target.checked)} />
          <span>{t('acceptTerms')}</span>
        </label>
        {errorBox}
        <Button type="submit" disabled={pending || !displayName.trim() || !email.trim() || !password || !confirmPassword || !acceptTerms}>
          {pending ? t('working') : t('sendCode')}
        </Button>
      </form>
    );
  }

  if (step.kind === 'signup-verify') {
    return (
      <form onSubmit={finishSignup} className="flex flex-col gap-4" noValidate>
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
          {pending ? t('working') : t('createAccount')}
        </Button>
        <Button type="button" variant="ghost" onClick={() => { setStep({ kind: 'signup' }); setError(null); }}>
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
                onChange={() => { setChannel(value); setTarget(''); setError(null); }}
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
        {channel === 'sms' ? <p id={ids.hint} className="text-xs text-muted-foreground">{t('phoneHint')}</p> : null}
      </div>
      {errorBox}
      <Button type="submit" disabled={pending || !target.trim()}>
        {pending ? t('working') : t('sendCode')}
      </Button>
      <Button type="button" variant="ghost" onClick={() => { setStep({ kind: 'password' }); setError(null); }}>
        {t('usePassword')}
      </Button>
    </form>
  );
}
