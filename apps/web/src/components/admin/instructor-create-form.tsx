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
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const parsed = AdminCreateInstructorSchema.safeParse({ displayName, email, phone, headline, password });
    if (!parsed.success) {
      setError(t('errors.invalidInstructor'));
      return;
    }

    setPending(true);
    setError(null);
    try {
      await api('POST', 'admin/users/instructors', parsed.data satisfies AdminCreateInstructor);
      setStatus(t('instructorCreated'));
      close();
    } catch (requestError) {
      const code = requestError instanceof ApiClientError ? requestError.body?.code : undefined;
      setError(code === 'ACCOUNT_EXISTS' ? t('errors.accountExists') : t('errors.actionFailed'));
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
                <Input id="new-instructor-email" type="email" autoComplete="email" required maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="new-instructor-phone">{t('instructorPhone')}</Label>
                <Input id="new-instructor-phone" type="tel" autoComplete="tel" placeholder="+919876543210" value={phone} onChange={(event) => setPhone(event.target.value)} />
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
                <Button type="submit" disabled={pending || !displayName.trim() || !email.trim() || !password}>
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
