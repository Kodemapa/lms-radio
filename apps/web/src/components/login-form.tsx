'use client';

import {
  AUTH_ERROR_CODES,
  OtpRequestResponseSchema,
  PASSWORD_MIN_LENGTH,
  UserProfileSchema,
  type OtpChannel,
} from '@obgyn/types';
import { Button, Input, Label, toast, toastAfterReload } from '@obgyn/ui';
import { Eye, EyeOff } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useId, useState, type FormEvent, type ReactNode } from 'react';
import { RequiredLabel } from '@/components/admin/required-label';
import { GlobalLoader } from '@/components/layout/page-loader';
import { Link } from '@/i18n/navigation';
import { getDeviceId } from '@/lib/device';
import { postLoginPath } from '@/lib/paths';
import { setSessionScope } from '@/lib/client-fetch';
import { showNavigationLoader } from '@/components/layout/navigation-progress';

/** 10 digits after +91, starting 6–9 (Indian mobile numbers). */
const MOBILE_DIGITS = /^[6-9]\d{9}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CODE = /^\d{6}$/;
/** Matches the API's per-number resend cooldown. */
const RESEND_SECONDS = 60;

type Challenge = { challengeId: string; target: string; expiresAt: string };
type Step =
  | { kind: 'password' }
  | { kind: 'otp-request' }
  | ({ kind: 'otp-verify' } & Challenge)
  | { kind: 'forgot-request' }
  | ({ kind: 'forgot-verify' } & Challenge)
  | { kind: 'signup' }
  | ({ kind: 'signup-verify' } & Challenge);

type FieldKey =
  | 'identifier'
  | 'password'
  | 'name'
  | 'email'
  | 'phone'
  | 'confirmPassword'
  | 'terms'
  | 'code'
  | 'target';
type FieldErrors = Partial<Record<FieldKey, string>>;

/** Keep only the 10 local digits; a pasted "+91 98765-43210" or "919876543210" also works. */
function mobileDigits(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  return digits.length > 10 && digits.startsWith('91') ? digits.slice(2, 12) : digits.slice(0, 10);
}

/** Email as typed (lower-cased), or a mobile number in +91XXXXXXXXXX form. */
function normaliseIdentifier(raw: string): string {
  const value = raw.trim();
  if (value.includes('@')) return value.toLowerCase();
  const digits = value.replace(/\D/g, '');
  if (/^\d{10}$/.test(digits)) return `+91${digits}`;
  if (/^91\d{10}$/.test(digits)) return `+${digits}`;
  return value;
}

function isIdentifier(value: string): boolean {
  return EMAIL.test(value) || /^\+91[6-9]\d{9}$/.test(value);
}

function minutesLeft(expiresAt: string): number {
  return Math.max(1, Math.round((new Date(expiresAt).getTime() - Date.now()) / 60_000));
}

/**
 * Sign-in, OTP, sign-up and password-reset forms. While a request runs, and while the app
 * moves to the next page after signing in, the site's global loader covers the screen.
 */
export function LoginForm(props: { next: string | null; register?: boolean }) {
  const [busy, setBusy] = useState<string | null>(null);
  return (
    <>
      {/* source="nav": hides under the destination page's own loader, so they never stack. */}
      {busy ? <GlobalLoader label={busy} source="nav" /> : null}
      <LoginFormSteps {...props} onBusy={setBusy} />
    </>
  );
}

function LoginFormSteps({
  next,
  register = false,
  onBusy,
}: {
  next: string | null;
  register?: boolean;
  onBusy: (label: string | null) => void;
}) {
  const t = useTranslations('Login');
  const locale = useLocale();
  const ids = {
    target: useId(),
    code: useId(),
    error: useId(),
    email: useId(),
    password: useId(),
    name: useId(),
    phone: useId(),
    confirmPassword: useId(),
    terms: useId(),
  };

  const [step, setStep] = useState<Step>(register ? { kind: 'signup' } : { kind: 'password' });
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [channel, setChannel] = useState<OtpChannel>('sms');
  const [target, setTarget] = useState('');
  const [code, setCode] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [phone, setPhone] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  /** Overlay text for the current request; null means the generic "Please wait…". */
  const [busyLabel, setBusyLabel] = useState<string | null>(null);
  /** Signed in: the next page is loading. Stays true until this form unmounts. */
  const [redirecting, setRedirecting] = useState(false);
  const [resendIn, setResendIn] = useState(0);

  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendIn]);

  function go(nextStep: Step) {
    setStep(nextStep);
    setError(null);
    setFieldErrors({});
    setNotice(null);
  }

  function passwordProblem(value: string): string | undefined {
    if (!value) return t('errors.passwordRequired');
    if (value.length < PASSWORD_MIN_LENGTH) return t('errors.passwordTooShort', { min: PASSWORD_MIN_LENGTH });
    if (!/[A-Za-z]/.test(value)) return t('errors.passwordNeedsLetter');
    if (!/\d/.test(value)) return t('errors.passwordNeedsNumber');
    return undefined;
  }

  /** Show validation errors under their fields; returns true when there are none. */
  function check(errors: FieldErrors): boolean {
    const clean = Object.fromEntries(Object.entries(errors).filter(([, v]) => v)) as FieldErrors;
    setFieldErrors(clean);
    setError(null);
    return Object.keys(clean).length === 0;
  }

  /** Turn an API/BFF failure into a message, placed on the field it concerns when possible. */
  async function showFailure(res: Response, codeField: FieldKey = 'code') {
    const body = (await res.json().catch(() => null)) as { code?: string; message?: string | string[] } | null;
    const fail = (message: string, field?: FieldKey) => {
      if (field) {
        setFieldErrors({ [field]: message });
        setError(null);
      } else {
        setFieldErrors({});
        setError(message);
      }
    };
    if (res.status === 429) return fail(t('errors.tooMany'));
    // 503 means two different things: the API refused to send a code (OTP delivery), or the
    // web server could not reach the API at all (BFF `upstreamUnavailable`). Only the first is
    // about code delivery — the second can happen on plain password sign-in.
    if (res.status === 503) {
      return fail(body?.message === 'Service unavailable' ? t('errors.serviceUnavailable') : t('errors.deliveryUnavailable'));
    }
    // The site is restarting or its proxy timed out (nginx 502/504, often an HTML page).
    if (res.status === 502 || res.status === 504) return fail(t('errors.serviceUnavailable'));
    if (res.status >= 500) {
      console.error(`Sign-in step failed with ${res.status} (trace ${res.headers.get('x-trace-id') ?? 'n/a'})`);
      return fail(t('errors.generic'));
    }
    switch (body?.code) {
      case AUTH_ERROR_CODES.deviceLimit:
        return fail(t('errors.deviceLimit'));
      case AUTH_ERROR_CODES.deviceRevoked:
        return fail(t('errors.deviceRevoked'));
      case AUTH_ERROR_CODES.accountBlocked:
        return fail(t('errors.accountBlocked'));
      case AUTH_ERROR_CODES.accountExists:
        return fail(t('errors.accountExists'));
      case AUTH_ERROR_CODES.noAccount:
        return fail(t('errors.noAccount'));
      case AUTH_ERROR_CODES.invalidCredentials:
        return fail(t('errors.invalidPassword'));
      case AUTH_ERROR_CODES.otpInvalid:
        return fail(t('errors.invalidCode'), codeField);
    }
    if (res.status === 400) {
      // class-validator messages name the field, e.g. "phone must look like +919876543210".
      const text = [body?.message ?? []].flat().join(' ').toLowerCase();
      if (text.includes('password')) return fail(t('errors.passwordWeak'), step.kind === 'signup-verify' ? undefined : 'password');
      if (text.includes('phone') || text.includes('mobile')) return fail(t('errors.phoneInvalid'));
      if (text.includes('email')) return fail(t('errors.emailInvalid'));
      if (text.includes('displayname')) return fail(t('errors.nameRequired'));
      if (text.includes('code')) return fail(t('errors.codeRequired'), codeField);
      return fail(t('errors.invalidInput'));
    }
    if (res.status === 401) return fail(t('errors.invalidCode'), codeField);
    return fail(t('errors.generic'));
  }

  /**
   * Password sign-in, retried once if the site answered "temporarily unavailable" (it was
   * restarting during a deploy). Not used for one-time codes: a retried code could be spent.
   */
  async function postLogin(body: unknown): Promise<Response> {
    const first = await post('/api/auth/login', body);
    if (![502, 503, 504].includes(first.status)) return first;
    await new Promise((resolve) => setTimeout(resolve, 2000));
    return post('/api/auth/login', body);
  }

  async function post(url: string, body: unknown): Promise<Response> {
    return fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
  }

  // Tell the wrapper whether to show the global loader, and with which text.
  useEffect(() => {
    onBusy(redirecting ? t('signingIn') : pending ? (busyLabel ?? t('working')) : null);
  }, [onBusy, redirecting, pending, busyLabel, t]);

  async function run(action: () => Promise<void>) {
    setPending(true);
    try {
      await action();
    } catch (error) {
      // fetch() rejects with a TypeError when no answer came back at all: the device is
      // offline, or the connection dropped. Anything else is a bug: keep it visible in the console.
      if (error instanceof TypeError && !navigator.onLine) setError(t('errors.offline'));
      else if (error instanceof TypeError) setError(t('errors.serviceUnavailable'));
      else {
        console.error('Sign-in failed', error);
        setError(t('errors.generic'));
      }
      setRedirecting(false);
    } finally {
      setPending(false);
      setBusyLabel(null);
    }
  }

  const device = () => ({ deviceId: getDeviceId(), deviceLabel: navigator.userAgent.slice(0, 100) });

  async function continueAfterAuthentication(session: Response, kind: 'signedIn' | 'accountCreated' = 'signedIn') {
    setRedirecting(true);
    const body = (await session.json().catch(() => null)) as { userId?: unknown; role?: unknown } | null;
    let userId = typeof body?.userId === 'string' ? body.userId : null;
    let role = typeof body?.role === 'string' ? body.role : null;
    if (!userId || !role) {
      const res = await fetch('/api/proxy/users/me', { cache: 'no-store' });
      const profile = res.ok ? UserProfileSchema.safeParse(await res.json()) : null;
      if (!profile?.success) throw new Error('Could not resolve the signed-in account');
      userId = profile.data.id;
      role = profile.data.role;
    }
    // Drop old account data locally and in other tabs before replacing the document.
    setSessionScope(userId, role);
    toastAfterReload('success', t(`toast.${kind}`));
    showNavigationLoader();
    // `next` is followed only if it suits this role: it may come from another account's
    // session that ended on its dashboard (see postLoginPath).
    window.location.replace(postLoginPath(next, role, locale));
  }

  // ---- Password sign-in (default) -------------------------------------------------------

  async function passwordLogin(event: FormEvent) {
    event.preventDefault();
    const identifier = normaliseIdentifier(target);
    if (
      !check({
        identifier: !target.trim()
          ? t('errors.identifierRequired')
          : !isIdentifier(identifier)
            ? t('errors.identifierInvalid')
            : undefined,
        password: password ? undefined : t('errors.passwordRequired'),
      })
    )
      return;
    setBusyLabel(t('signingIn'));
    await run(async () => {
      const res = await postLogin({ identifier, password, ...device() });
      if (!res.ok) return showFailure(res);
      await continueAfterAuthentication(res);
    });
  }

  // ---- One-time codes (OTP sign-in, sign-up, forgot password) --------------------------

  /** Request a code; on success moves to `verifyKind` (or stays there on resend). */
  async function sendCode(
    url: string,
    body: unknown,
    shownTarget: string,
    verifyKind: 'otp-verify' | 'signup-verify' | 'forgot-verify',
    targetField: FieldKey,
  ) {
    await run(async () => {
      const res = await post(url, body);
      if (!res.ok) return showFailure(res, targetField);
      const { challengeId, expiresAt } = OtpRequestResponseSchema.parse(await res.json());
      const resend = step.kind === verifyKind;
      setStep({ kind: verifyKind, challengeId, target: shownTarget, expiresAt });
      setCode('');
      setFieldErrors({});
      setError(null);
      setNotice(resend ? t('codeResent') : null);
      toast.info(resend ? t('codeResent') : t('codeSentTo', { target: shownTarget }));
      setResendIn(RESEND_SECONDS);
    });
  }

  function otpTarget(): { value: string; problem?: string } {
    if (channel === 'sms') {
      return {
        value: `+91${phone}`,
        problem: !phone ? t('errors.phoneRequired') : !MOBILE_DIGITS.test(phone) ? t('errors.phoneInvalid') : undefined,
      };
    }
    const value = email.trim().toLowerCase();
    return {
      value,
      problem: !value ? t('errors.emailRequired') : !EMAIL.test(value) ? t('errors.emailInvalid') : undefined,
    };
  }

  async function requestLoginCode(event?: FormEvent) {
    event?.preventDefault();
    const { value, problem } = otpTarget();
    if (!check({ [channel === 'sms' ? 'phone' : 'email']: problem })) return;
    await sendCode('/api/auth/otp/request', { channel, target: value }, value, 'otp-verify', channel === 'sms' ? 'phone' : 'email');
  }

  async function verifyLoginCode(event: FormEvent) {
    event.preventDefault();
    if (step.kind !== 'otp-verify') return;
    if (!check({ code: CODE.test(code) ? undefined : t('errors.codeRequired') })) return;
    setBusyLabel(t('signingIn'));
    await run(async () => {
      const res = await post('/api/auth/otp/verify', { challengeId: step.challengeId, code, ...device() });
      if (!res.ok) return showFailure(res);
      await continueAfterAuthentication(res);
    });
  }

  // ---- Sign-up: details → SMS code → account -----------------------------------------

  async function requestSignupCode(event?: FormEvent) {
    event?.preventDefault();
    const trimmedEmail = email.trim();
    const ok = check({
      name: displayName.trim().length < 2 ? t('errors.nameRequired') : undefined,
      phone: !phone ? t('errors.phoneRequired') : !MOBILE_DIGITS.test(phone) ? t('errors.phoneInvalid') : undefined,
      email: trimmedEmail && !EMAIL.test(trimmedEmail) ? t('errors.emailInvalid') : undefined,
      password: passwordProblem(password),
      confirmPassword: !confirmPassword
        ? t('errors.confirmRequired')
        : confirmPassword !== password
          ? t('errors.passwordMismatch')
          : undefined,
      terms: acceptTerms ? undefined : t('errors.termsRequired'),
    });
    if (!ok) return;
    const mobile = `+91${phone}`;
    await sendCode('/api/auth/otp/request', { channel: 'sms', target: mobile }, mobile, 'signup-verify', 'phone');
  }

  async function finishSignup(event: FormEvent) {
    event.preventDefault();
    if (step.kind !== 'signup-verify') return;
    if (!check({ code: CODE.test(code) ? undefined : t('errors.codeRequired') })) return;
    setBusyLabel(t('creatingAccount'));
    await run(async () => {
      const res = await post('/api/auth/signup', {
        displayName: displayName.trim(),
        email: email.trim() ? email.trim().toLowerCase() : undefined,
        phone: `+91${phone}`,
        password,
        challengeId: step.challengeId,
        code,
        acceptTerms: true,
        ...device(),
      });
      if (!res.ok) return showFailure(res);
      await continueAfterAuthentication(res, 'accountCreated');
    });
  }

  // ---- Forgot password ----------------------------------------------------------------

  async function requestPasswordReset(event?: FormEvent) {
    event?.preventDefault();
    const identifier = normaliseIdentifier(target);
    if (
      !check({
        target: !target.trim()
          ? t('errors.identifierRequired')
          : !isIdentifier(identifier)
            ? t('errors.identifierInvalid')
            : undefined,
      })
    )
      return;
    setPassword('');
    setConfirmPassword('');
    await sendCode('/api/auth/password/forgot', { target: identifier }, identifier, 'forgot-verify', 'target');
  }

  async function finishPasswordReset(event: FormEvent) {
    event.preventDefault();
    if (step.kind !== 'forgot-verify') return;
    const ok = check({
      code: CODE.test(code) ? undefined : t('errors.codeRequired'),
      password: passwordProblem(password),
      confirmPassword: !confirmPassword
        ? t('errors.confirmRequired')
        : confirmPassword !== password
          ? t('errors.passwordMismatch')
          : undefined,
    });
    if (!ok) return;
    await run(async () => {
      const res = await post('/api/auth/password/reset', {
        challengeId: step.challengeId,
        code,
        newPassword: password,
      });
      if (!res.ok) return showFailure(res);
      go({ kind: 'password' });
      setCode('');
      setPassword('');
      setConfirmPassword('');
      setNotice(t('resetSuccess'));
      toast.success(t('resetSuccess'));
    });
  }

  // ---- Rendering ------------------------------------------------------------------------

  const errorBox = error ? (
    <p id={ids.error} role="alert" className="text-sm text-destructive">
      {error}
    </p>
  ) : null;
  const noticeBox = notice ? (
    <p role="status" className="text-sm text-success">
      {notice}
    </p>
  ) : null;

  const field = (key: FieldKey, id: string, label: ReactNode, required: boolean, control: ReactNode, hint?: string) => (
    <div className="flex flex-col gap-2">
      {required ? <RequiredLabel htmlFor={id}>{label}</RequiredLabel> : <Label htmlFor={id}>{label}</Label>}
      {control}
      {hint ? (
        <p id={`${id}-hint`} className="text-xs text-muted-foreground">
          {hint}
        </p>
      ) : null}
      {fieldErrors[key] ? (
        <p id={`${id}-error`} role="alert" className="text-sm text-destructive">
          {fieldErrors[key]}
        </p>
      ) : null}
    </div>
  );

  /** aria props tying an input to its hint and error text. */
  const aria = (key: FieldKey, id: string, hint = false) => ({
    'aria-invalid': !!fieldErrors[key] || undefined,
    'aria-describedby': [hint ? `${id}-hint` : '', fieldErrors[key] ? `${id}-error` : ''].join(' ').trim() || undefined,
  });

  const mobileInput = (autoFocus = false) => (
    <div className="flex items-stretch">
      <span
        aria-hidden
        className="flex items-center rounded-s-md border border-e-0 border-input bg-muted px-3 text-sm font-medium text-muted-foreground"
      >
        +91
      </span>
      <Input
        id={ids.phone}
        type="tel"
        inputMode="numeric"
        autoComplete="tel-national"
        placeholder="9876543210"
        required
        autoFocus={autoFocus}
        className="rounded-s-none"
        aria-label={`${t('phoneLabel')} (+91)`}
        value={phone}
        {...aria('phone', ids.phone, true)}
        onChange={(e) => setPhone(mobileDigits(e.target.value))}
      />
    </div>
  );

  const passwordInput = (
    key: 'password' | 'confirmPassword',
    id: string,
    value: string,
    setValue: (v: string) => void,
    autoComplete: string,
    hint = false,
  ) => <PasswordInput id={id} value={value} onChange={setValue} autoComplete={autoComplete} labels={t} {...aria(key, id, hint)} />;

  const codeInput = (
    <Input
      id={ids.code}
      inputMode="numeric"
      autoComplete="one-time-code"
      pattern="\d{6}"
      maxLength={6}
      required
      autoFocus
      value={code}
      {...aria('code', ids.code)}
      onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
    />
  );

  const codeSentBlock = (challenge: Challenge, message: string, resend: () => void) => (
    <>
      <p className="text-sm">{message}</p>
      <p className="text-xs text-muted-foreground">{t('codeExpires', { minutes: minutesLeft(challenge.expiresAt) })}</p>
      {field('code', ids.code, t('codeLabel'), true, codeInput)}
      <Button type="button" variant="outline" disabled={pending || resendIn > 0} onClick={resend}>
        {resendIn > 0 ? t('resendIn', { seconds: resendIn }) : t('resendCode')}
      </Button>
    </>
  );

  if (step.kind === 'password') {
    return (
      <form onSubmit={passwordLogin} className="flex flex-col gap-4" noValidate>
        {field(
          'identifier',
          ids.target,
          t('identifierLabel'),
          true,
          <Input
            id={ids.target}
            type="text"
            autoComplete="username"
            placeholder={t('identifierPlaceholder')}
            required
            autoFocus
            value={target}
            {...aria('identifier', ids.target)}
            onChange={(e) => setTarget(e.target.value)}
          />,
        )}
        {field('password', ids.password, t('passwordLabel'), true, passwordInput('password', ids.password, password, setPassword, 'current-password'))}
        {noticeBox}
        {errorBox}
        <Button type="submit" disabled={pending}>
          {pending ? t('working') : t('signIn')}
        </Button>
        <Button type="button" variant="ghost" onClick={() => go({ kind: 'forgot-request' })}>
          {t('forgotPassword')}
        </Button>
        <Button type="button" variant="ghost" onClick={() => go({ kind: 'otp-request' })}>
          {t('useOtp')}
        </Button>
      </form>
    );
  }

  if (step.kind === 'otp-verify') {
    return (
      <form onSubmit={verifyLoginCode} className="flex flex-col gap-4" noValidate>
        {codeSentBlock(step, t('codeSentTo', { target: step.target }), () => void requestLoginCode())}
        {noticeBox}
        {errorBox}
        <Button type="submit" disabled={pending}>
          {pending ? t('working') : t('verify')}
        </Button>
        <Button type="button" variant="ghost" onClick={() => go({ kind: 'otp-request' })}>
          {t('changeTarget')}
        </Button>
      </form>
    );
  }

  if (step.kind === 'signup') {
    return (
      <form onSubmit={requestSignupCode} className="flex flex-col gap-4" noValidate>
        {field(
          'name',
          ids.name,
          t('nameLabel'),
          true,
          <Input
            id={ids.name}
            autoComplete="name"
            required
            autoFocus
            maxLength={100}
            value={displayName}
            {...aria('name', ids.name)}
            onChange={(e) => setDisplayName(e.target.value)}
          />,
        )}
        {field('phone', ids.phone, t('phoneLabel'), true, mobileInput(), t('phoneHint'))}
        {field(
          'email',
          ids.email,
          t('emailOptional'),
          false,
          <Input
            id={ids.email}
            type="email"
            autoComplete="email"
            maxLength={254}
            value={email}
            {...aria('email', ids.email)}
            onChange={(e) => setEmail(e.target.value)}
          />,
        )}
        {field(
          'password',
          ids.password,
          t('passwordLabel'),
          true,
          passwordInput('password', ids.password, password, setPassword, 'new-password', true),
          t('passwordHint'),
        )}
        {field(
          'confirmPassword',
          ids.confirmPassword,
          t('confirmPassword'),
          true,
          passwordInput('confirmPassword', ids.confirmPassword, confirmPassword, setConfirmPassword, 'new-password'),
        )}
        <div className="flex flex-col gap-2">
          <label htmlFor={ids.terms} className="flex items-start gap-2 text-sm">
            <input
              id={ids.terms}
              type="checkbox"
              className="mt-1 size-4"
              required
              checked={acceptTerms}
              {...aria('terms', ids.terms)}
              onChange={(e) => setAcceptTerms(e.target.checked)}
            />
            <span>
              {t('acceptTerms')}
              <span aria-hidden="true" className="ms-1 text-destructive">
                *
              </span>
            </span>
          </label>
          {fieldErrors.terms ? (
            <p id={`${ids.terms}-error`} role="alert" className="text-sm text-destructive">
              {fieldErrors.terms}
            </p>
          ) : null}
        </div>
        {errorBox}
        <Button type="submit" disabled={pending}>
          {pending ? t('working') : t('sendCode')}
        </Button>
        <p className="text-xs text-muted-foreground">
          {t('instructorHint')}{' '}
          <Link href="/become-instructor" className="font-medium text-primary hover:underline">
            {t('becomeInstructor')}
          </Link>
        </p>
      </form>
    );
  }

  if (step.kind === 'signup-verify') {
    return (
      <form onSubmit={finishSignup} className="flex flex-col gap-4" noValidate>
        {codeSentBlock(step, t('codeSentTo', { target: step.target }), () => void requestSignupCode())}
        {noticeBox}
        {errorBox}
        <Button type="submit" disabled={pending}>
          {pending ? t('working') : t('createAccount')}
        </Button>
        <Button type="button" variant="ghost" onClick={() => go({ kind: 'signup' })}>
          {t('editDetails')}
        </Button>
      </form>
    );
  }

  if (step.kind === 'forgot-request') {
    return (
      <form onSubmit={requestPasswordReset} className="flex flex-col gap-4" noValidate>
        <p className="text-sm text-muted-foreground">{t('forgotIntro')}</p>
        {field(
          'target',
          ids.target,
          t('identifierLabel'),
          true,
          <Input
            id={ids.target}
            type="text"
            autoComplete="username"
            placeholder={t('identifierPlaceholder')}
            required
            autoFocus
            value={target}
            {...aria('target', ids.target)}
            onChange={(e) => setTarget(e.target.value)}
          />,
        )}
        {errorBox}
        <Button type="submit" disabled={pending}>
          {pending ? t('working') : t('sendCode')}
        </Button>
        <Button type="button" variant="ghost" onClick={() => go({ kind: 'password' })}>
          {t('usePassword')}
        </Button>
      </form>
    );
  }

  if (step.kind === 'forgot-verify') {
    return (
      <form onSubmit={finishPasswordReset} className="flex flex-col gap-4" noValidate>
        {codeSentBlock(step, t('resetCodeIfRegistered', { target: step.target }), () => void requestPasswordReset())}
        {field(
          'password',
          ids.password,
          t('newPasswordLabel'),
          true,
          passwordInput('password', ids.password, password, setPassword, 'new-password', true),
          t('passwordHint'),
        )}
        {field(
          'confirmPassword',
          ids.confirmPassword,
          t('confirmPassword'),
          true,
          passwordInput('confirmPassword', ids.confirmPassword, confirmPassword, setConfirmPassword, 'new-password'),
        )}
        {noticeBox}
        {errorBox}
        <Button type="submit" disabled={pending}>
          {pending ? t('working') : t('resetPassword')}
        </Button>
        <Button type="button" variant="ghost" onClick={() => go({ kind: 'forgot-request' })}>
          {t('changeTarget')}
        </Button>
      </form>
    );
  }

  // OTP sign-in: choose SMS or email.
  return (
    <form onSubmit={requestLoginCode} className="flex flex-col gap-4" noValidate>
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
                  setFieldErrors({});
                  setError(null);
                }}
              />
              {value === 'sms' ? t('channelSms') : t('channelEmail')}
            </label>
          ))}
        </div>
      </fieldset>
      {channel === 'sms'
        ? field('phone', ids.phone, t('phoneLabel'), true, mobileInput(true), t('phoneHint'))
        : field(
            'email',
            ids.email,
            t('emailLabel'),
            true,
            <Input
              id={ids.email}
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              required
              autoFocus
              value={email}
              {...aria('email', ids.email)}
              onChange={(e) => setEmail(e.target.value)}
            />,
          )}
      {errorBox}
      <Button type="submit" disabled={pending}>
        {pending ? t('working') : t('sendCode')}
      </Button>
      <Button type="button" variant="ghost" onClick={() => go({ kind: 'password' })}>
        {t('usePassword')}
      </Button>
    </form>
  );
}

/** Password box with a show/hide eye toggle. */
function PasswordInput({
  id,
  value,
  onChange,
  autoComplete,
  labels,
  ...rest
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: string;
  labels: (key: 'showPassword' | 'hidePassword') => string;
  'aria-invalid'?: boolean;
  'aria-describedby'?: string;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <Input
        id={id}
        type={visible ? 'text' : 'password'}
        autoComplete={autoComplete}
        required
        className="pe-11"
        value={value}
        {...rest}
        onChange={(e) => onChange(e.target.value)}
      />
      <button
        type="button"
        className="absolute inset-y-0 end-0 flex w-11 items-center justify-center rounded-e-md text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label={visible ? labels('hidePassword') : labels('showPassword')}
        aria-pressed={visible}
        aria-controls={id}
        onClick={() => setVisible((v) => !v)}
      >
        {visible ? <EyeOff aria-hidden className="size-4" /> : <Eye aria-hidden className="size-4" />}
      </button>
    </div>
  );
}
