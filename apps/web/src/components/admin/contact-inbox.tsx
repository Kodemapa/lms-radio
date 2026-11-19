'use client';

import { type ContactMessage } from '@obgyn/types';
import { Button, toast } from '@obgyn/ui';
import { CheckCircle2, Mail, RotateCcw, Trash2 } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import { useState } from 'react';
import { ConfirmDialog } from '@/components/instructor/confirm-dialog';
import { api } from '@/lib/instructor-api';

/** Contact-form inbox: reply by email, mark handled / reopen, delete (DPDP erasure). */
export function ContactInbox({ initial }: { initial: ContactMessage[] }) {
  const t = useTranslations('Admin.inbox');
  const tCommon = useTranslations('Common');
  const format = useFormatter();
  const [messages, setMessages] = useState(initial);
  const [deleting, setDeleting] = useState<ContactMessage | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const setMessageStatus = async (message: ContactMessage, next: ContactMessage['status']) => {
    setBusy(message.id);
    setError(null);
    try {
      const updated = await api<ContactMessage>('PATCH', `admin/content/contact/${message.id}`, { status: next });
      setMessages((list) => list.map((item) => (item.id === message.id ? updated : item)));
      toast.success(next === 'HANDLED' ? t('markedHandled') : t('reopened'));
    } catch {
      setError(t('errors.failed'));
    } finally {
      setBusy(null);
    }
  };

  const meta = (message: ContactMessage) => {
    const sent = format.dateTime(new Date(message.createdAt), { dateStyle: 'medium', timeStyle: 'short' });
    if (message.status !== 'HANDLED' || !message.handledAt) return sent;
    const handled = t('handledBy', {
      name: message.handledByName ?? t('unknownAdmin'),
      date: format.dateTime(new Date(message.handledAt), { dateStyle: 'medium' }),
    });
    return `${sent} · ${handled}`;
  };

  return (
    <div className="flex flex-col gap-3">
      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
      {messages.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border bg-card p-10 text-center text-muted-foreground">{t('empty')}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {messages.map((message) => (
            <li key={message.id} className="rounded-2xl border border-border bg-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold">
                    {message.status === 'NEW' ? (
                      <span className="me-2 rounded-full bg-primary-light px-2 py-0.5 text-xs font-medium text-primary">{t('new')}</span>
                    ) : null}
                    {message.subject}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {message.name}
                    {' · '}
                    <a href={`mailto:${message.email}`} className="hover:text-primary hover:underline">{message.email}</a>
                    {message.phone ? <span>{' · '}{message.phone}</span> : null}
                    {' · '}
                    {message.locale}
                  </p>
                  <p className="text-xs text-muted-foreground">{meta(message)}</p>
                </div>
                <div className="flex flex-wrap gap-1">
                  <a
                    href={`mailto:${message.email}?subject=${encodeURIComponent(`Re: ${message.subject}`)}`}
                    className="inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-sm hover:bg-muted"
                  >
                    <Mail aria-hidden className="size-4" />
                    {t('reply')}
                  </a>
                  {message.status === 'NEW' ? (
                    <Button size="sm" variant="ghost" disabled={busy === message.id} onClick={() => setMessageStatus(message, 'HANDLED')}>
                      <CheckCircle2 aria-hidden className="size-4" />
                      {t('markHandled')}
                    </Button>
                  ) : (
                    <Button size="sm" variant="ghost" disabled={busy === message.id} onClick={() => setMessageStatus(message, 'NEW')}>
                      <RotateCcw aria-hidden className="size-4" />
                      {t('reopen')}
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" aria-label={t('delete', { subject: message.subject })} onClick={() => setDeleting(message)}>
                    <Trash2 aria-hidden className="size-4" />
                  </Button>
                </div>
              </div>
              <p className="mt-3 whitespace-pre-wrap break-words text-sm">{message.message}</p>
            </li>
          ))}
        </ul>
      )}
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={t('deleteTitle')}
        body={t('deleteBody')}
        confirmLabel={tCommon('delete')}
        onConfirm={async () => {
          if (!deleting) return;
          try {
            await api('DELETE', `admin/content/contact/${deleting.id}`);
            setMessages((list) => list.filter((item) => item.id !== deleting.id));
            toast.success(t('deleted'));
            setDeleting(null);
          } catch {
            setError(t('errors.failed'));
          }
        }}
      />
    </div>
  );
}
