'use client';

import { AdminCreateInstructorSchema, type AdminCreateInstructor } from '@obgyn/types';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
} from '@obgyn/ui';
import { useTranslations } from 'next-intl';
import { useState, type FormEvent } from 'react';
import { ApiClientError, api } from '@/lib/instructor-api';
import { RequiredLabel } from './required-label';

export function InstructorCreateForm() {
  const t = useTranslations('Admin');
  const tCommon = useTranslations('Common');
  const [open, setOpen] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [headline, setHeadline] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  /** Problems shown under the email or mobile field. */
  const [fieldError, setFieldError] = useState<{ email?: string; phone?: string }>({});
  const [status, setStatus] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const close = () => {
    setOpen(false);
    setDisplayName('');
    setEmail('');
    setPhone('');
    setHeadline('');
    setPassword('');
    setError(null);
    setFieldError({});
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    // The mobile is entered as 10 digits after a fixed +91.
    if (!/^[6-9]\d{9}$/.test(phone)) {
      setFieldError({ phone: phone ? t('errors.phoneInvalid') : t('errors.phoneRequired') });
      setError(null);
      return;
    }
    const parsed = AdminCreateInstructorSchema.safeParse({ displayName, email, phone: `+91${phone}`, headline, password });
    if (!parsed.success) {
      setFieldError({});
      setError(t('errors.invalidInstructor'));
      return;
    }

    setPending(true);
    setError(null);
    setFieldError({});
    try {
      await api('POST', 'admin/users/instructors', parsed.data satisfies AdminCreateInstructor);
      setStatus(t('instructorCreated'));
      close();
    } catch (requestError) {
      const code = requestError instanceof ApiClientError ? requestError.body?.code : undefined;
      if (code === 'PHONE_IN_USE') setFieldError({ phone: t('errors.phoneInUse') });
      else if (code === 'EMAIL_IN_USE') setFieldError({ email: t('errors.emailInUse') });
      else setError(code === 'ACCOUNT_EXISTS' ? t('errors.accountExists') : t('errors.actionFailed'));
    } finally {
      setPending(false);
    }
  };

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p role="status" aria-live="polite" className="text-sm text-muted-foreground">{status}</p>
        <Button onClick={() => { setError(null); setOpen(true); }}>{t('addInstructor')}</Button>
      </div>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!next && !pending) close();
        }}
      >
        {open ? (
          <DialogContent closeLabel={tCommon('close')}>
            <form onSubmit={submit} className="flex max-h-[80vh] flex-col gap-4 overflow-y-auto" noValidate>
              <DialogHeader>
                <DialogTitle>{t('addInstructorTitle')}</DialogTitle>
                <DialogDescription>{t('addInstructorDescription')}</DialogDescription>
              </DialogHeader>
              <div className="flex flex-col gap-1.5">
                <RequiredLabel htmlFor="new-instructor-name">{t('instructorName')}</RequiredLabel>
                <Input id="new-instructor-name" autoComplete="name" required maxLength={100} value={displayName} onChange={(event) => setDisplayName(event.target.value)} />
              </div>
              <div className="flex flex-col gap-1.5">
                <RequiredLabel htmlFor="new-instructor-email">{t('instructorEmail')}</RequiredLabel>
                <Input
                  id="new-instructor-email"
                  type="email"
                  autoComplete="email"
                  required
                  maxLength={254}
                  value={email}
                  aria-invalid={!!fieldError.email || undefined}
                  aria-describedby={fieldError.email ? 'new-instructor-email-error' : undefined}
                  onChange={(event) => {
                    setEmail(event.target.value);
                    setFieldError((current) => ({ ...current, email: undefined }));
                  }}
                />
                {fieldError.email ? (
                  <p id="new-instructor-email-error" role="alert" className="text-sm text-destructive">{fieldError.email}</p>
                ) : null}
              </div>
              <div className="flex flex-col gap-1.5">
                <RequiredLabel htmlFor="new-instructor-phone">{t('instructorMobile')}</RequiredLabel>
                <div className="flex items-stretch">
                  <span
                    aria-hidden
                    className="flex items-center rounded-s-xl border border-e-0 border-border bg-muted px-3 text-sm font-medium text-muted-foreground"
                  >
                    +91
                  </span>
                  <Input
                    id="new-instructor-phone"
                    type="tel"
                    inputMode="numeric"
                    autoComplete="tel-national"
                    placeholder="9876543210"
                    required
                    className="rounded-s-none"
                    value={phone}
                    aria-invalid={!!fieldError.phone || undefined}
                    aria-describedby={fieldError.phone ? 'new-instructor-phone-error' : 'new-instructor-phone-hint'}
                    onChange={(event) => {
                      // Keep the 10 local digits; a pasted "+91 98765-43210" also works.
                      const digits = event.target.value.replace(/\D/g, '');
                      setPhone((digits.length > 10 && digits.startsWith('91') ? digits.slice(2) : digits).slice(0, 10));
                      setFieldError((current) => ({ ...current, phone: undefined }));
                    }}
                  />
                </div>
                {fieldError.phone ? (
                  <p id="new-instructor-phone-error" role="alert" className="text-sm text-destructive">{fieldError.phone}</p>
                ) : (
                  <p id="new-instructor-phone-hint" className="text-xs text-muted-foreground">{t('instructorMobileHint')}</p>
                )}
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="new-instructor-headline">{t('headline')}</Label>
                <Input id="new-instructor-headline" maxLength={160} value={headline} onChange={(event) => setHeadline(event.target.value)} />
              </div>
              <div className="flex flex-col gap-1.5">
                <RequiredLabel htmlFor="new-instructor-password">{t('temporaryPassword')}</RequiredLabel>
                <Input id="new-instructor-password" type="password" autoComplete="new-password" required value={password} onChange={(event) => setPassword(event.target.value)} />
                <p className="text-xs text-muted-foreground">{t('temporaryPasswordHint')}</p>
              </div>
              {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
              <DialogFooter>
                <Button type="button" variant="outline" disabled={pending} onClick={close}>{tCommon('cancel')}</Button>
                <Button type="submit" disabled={pending || !displayName.trim() || !email.trim() || !phone || !password}>
                  {pending ? tCommon('saving') : t('addInstructor')}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        ) : null}
      </Dialog>
    </>
  );
}
