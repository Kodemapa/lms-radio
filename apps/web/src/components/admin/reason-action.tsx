'use client';

import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Textarea,
} from '@obgyn/ui';
import { useTranslations } from 'next-intl';
import { type FormEvent, useId, useState } from 'react';
import { useRouter } from '@/i18n/navigation';
import { ApiClientError, api } from '@/lib/instructor-api';
import { RequiredLabel } from './required-label';

/** A button that asks for an audit reason (3–500 characters), POSTs it, then refreshes the page. */
export function ReasonAction({
  path,
  label,
  title,
  description,
  destructive = false,
  errorMessages = {},
}: {
  path: string;
  label: string;
  title: string;
  description: string;
  destructive?: boolean;
  /** API error code → message. */
  errorMessages?: Record<string, string>;
}) {
  const t = useTranslations('Admin');
  const tCommon = useTranslations('Common');
  const router = useRouter();
  const id = useId();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (reason.trim().length < 3) return;
    setPending(true);
    setError(null);
    try {
      await api('POST', path, { reason: reason.trim() });
      setOpen(false);
      router.refresh();
    } catch (requestError) {
      const code = requestError instanceof ApiClientError ? requestError.body?.code : undefined;
      setError((code && errorMessages[code]) || t('errors.actionFailed'));
    } finally {
      setPending(false);
    }
  };

  return (
    <>
      <Button
        size="sm"
        variant={destructive ? 'destructive' : 'outline'}
        onClick={() => {
          setReason('');
          setError(null);
          setOpen(true);
        }}
      >
        {label}
      </Button>
      <Dialog open={open} onOpenChange={(next) => !pending && setOpen(next)}>
        <DialogContent closeLabel={tCommon('close')}>
          <form onSubmit={submit} className="flex flex-col gap-4">
            <DialogHeader>
              <DialogTitle>{title}</DialogTitle>
              <DialogDescription>{description}</DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-1.5">
              <RequiredLabel htmlFor={`${id}-reason`}>{t('reason')}</RequiredLabel>
              <Textarea
                id={`${id}-reason`}
                required
                minLength={3}
                maxLength={500}
                rows={3}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
              />
            </div>
            {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
            <DialogFooter>
              <Button type="button" variant="outline" disabled={pending} onClick={() => setOpen(false)}>
                {tCommon('cancel')}
              </Button>
              <Button type="submit" variant={destructive ? 'destructive' : 'default'} disabled={pending || reason.trim().length < 3}>
                {pending ? t('saving') : label}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
