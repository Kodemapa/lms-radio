'use client';

import { AdminMailTestInputSchema, type AdminMailStatus, type AdminMailTestResult } from '@obgyn/types';
import { Button, Input, Label } from '@obgyn/ui';
import { Mail, Send } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { type FormEvent, useState } from 'react';
import { ApiClientError, api } from '@/lib/instructor-api';

type Outcome = { tone: 'ok' | 'error'; text: string } | null;

/**
 * Outgoing email (CMS-4): the SMTP settings are environment secrets, so they
 * are shown read-only here; the admin can send a fixed test message.
 */
export function MailSettingsPanel({ status }: { status: AdminMailStatus | null }) {
  const t = useTranslations('Admin.mail');
  const [to, setTo] = useState(status?.adminEmail ?? '');
  const [pending, setPending] = useState(false);
  const [outcome, setOutcome] = useState<Outcome>(null);

  const send = async (event: FormEvent) => {
    event.preventDefault();
    const parsed = AdminMailTestInputSchema.safeParse({ to });
    if (!parsed.success) {
      setOutcome({ tone: 'error', text: t('errors.invalid') });
      return;
    }
    setPending(true);
    setOutcome(null);
    try {
      const result = await api<AdminMailTestResult>('POST', 'admin/mail/test', parsed.data);
      setOutcome(
        result.sent
          ? { tone: 'ok', text: t('sent', { to: parsed.data.to }) }
          : {
              tone: 'error',
              text:
                result.error === 'MAIL_DISABLED'
                  ? t('errors.disabled')
                  : result.error === 'UNDELIVERABLE'
                    ? t('errors.undeliverable')
                    : t('errors.smtp', { detail: result.detail ?? '—' }),
            },
      );
    } catch (error) {
      setOutcome({
        tone: 'error',
        text: error instanceof ApiClientError && error.status === 429 ? t('errors.tooMany') : t('errors.failed'),
      });
    } finally {
      setPending(false);
    }
  };

  const rows: [string, string][] = status?.enabled
    ? [
        [t('host'), `${status.host ?? '—'}:${status.port ?? '—'}`],
        [t('tls'), status.secure ? t('tlsOn') : t('tlsOff')],
        [t('from'), status.from ?? '—'],
        [t('appUrl'), status.appUrl ?? '—'],
      ]
    : [];

  return (
    <section aria-labelledby="mail-settings-title" className="surface flex flex-col gap-5 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="mail-settings-title" className="flex items-center gap-2 text-lg font-semibold">
          <Mail aria-hidden className="size-5 text-primary" />
          {t('title')}
        </h2>
        {status ? (
          <span
            className={`rounded-full px-3 py-1 text-xs font-semibold ${
              status.enabled ? 'bg-success/15 text-success' : 'bg-muted text-muted-foreground'
            }`}
          >
            {status.enabled ? t('on') : t('off')}
          </span>
        ) : null}
      </div>

      {status === null ? (
        <p role="alert" className="text-sm text-destructive">{t('errors.unavailable')}</p>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">{status.enabled ? t('intro') : t('offIntro')}</p>
          {rows.length ? (
            <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[max-content_minmax(0,1fr)]">
              {rows.map(([label, value]) => (
                <div key={label} className="contents">
                  <dt className="font-medium text-muted-foreground">{label}</dt>
                  <dd className="break-words font-mono">{value}</dd>
                </div>
              ))}
            </dl>
          ) : null}
          <p className="text-xs text-muted-foreground">{t('secretsNote')}</p>

          <form onSubmit={send} noValidate className="flex flex-col gap-2 border-t border-border pt-5">
            <Label htmlFor="mail-test-to">{t('testLabel')}</Label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                id="mail-test-to"
                type="email"
                inputMode="email"
                autoComplete="email"
                maxLength={254}
                className="sm:max-w-sm"
                aria-describedby="mail-test-help"
                value={to}
                onChange={(event) => setTo(event.target.value)}
              />
              <Button type="submit" disabled={pending || !status.enabled}>
                <Send aria-hidden className="size-4" />
                {pending ? t('sending') : t('sendTest')}
              </Button>
            </div>
            <p id="mail-test-help" className="text-xs text-muted-foreground">{t('testHelp')}</p>
            {/* Always mounted so screen readers announce the result. */}
            <p
              role="status"
              aria-live="polite"
              className={`text-sm ${outcome?.tone === 'error' ? 'text-destructive' : 'text-success'}`}
            >
              {outcome?.text}
            </p>
          </form>
        </>
      )}
    </section>
  );
}
