'use client';

import { ContactMessageInputSchema } from '@obgyn/types';
import { Button, Input, Label, Textarea } from '@obgyn/ui';
import { useLocale, useTranslations } from 'next-intl';
import { type FormEvent, useState } from 'react';
import { Link } from '@/i18n/navigation';

type Field = 'name' | 'email' | 'phone' | 'subject' | 'message' | 'consent';
const EMPTY = { name: '', email: '', phone: '', subject: '', message: '', consent: false, website: '' };

/** Public contact form. Messages land in the admin inbox (Admin → Contact messages). */
export function ContactForm() {
  const t = useTranslations('Contact');
  const locale = useLocale();
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'failed' | 'limited'>('idle');

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const parsed = ContactMessageInputSchema.safeParse({ ...form, website: form.website || undefined });
    if (!parsed.success) {
      const next: Partial<Record<Field, string>> = {};
      for (const issue of parsed.error.issues) {
        const field = issue.path[0] as Field;
        if (field && !next[field]) next[field] = t(`errors.${field}`);
      }
      setErrors(next);
      return;
    }
    setErrors({});
    setStatus('sending');
    try {
      const response = await fetch(`/api/contact?locale=${encodeURIComponent(locale)}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(parsed.data),
      });
      if (response.ok) {
        setForm(EMPTY);
        setStatus('sent');
      } else setStatus(response.status === 429 ? 'limited' : 'failed');
    } catch {
      setStatus('failed');
    }
  };

  if (status === 'sent') {
    return (
      <div role="status" className="surface rounded-2xl p-8 text-center">
        <p className="text-lg font-semibold">{t('sentTitle')}</p>
        <p className="mt-2 text-muted-foreground">{t('sentBody')}</p>
        <Button className="mt-6" variant="outline" onClick={() => setStatus('idle')}>{t('sendAnother')}</Button>
      </div>
    );
  }

  const describedBy = (field: Field) => (errors[field] ? `contact-${field}-error` : undefined);
  const fieldError = (field: Field) =>
    errors[field] ? <p id={`contact-${field}-error`} className="text-sm text-destructive">{errors[field]}</p> : null;

  return (
    <form onSubmit={submit} noValidate className="surface flex flex-col gap-5 rounded-2xl p-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="contact-name">{t('name')}</Label>
          <Input id="contact-name" autoComplete="name" required maxLength={120} value={form.name} aria-invalid={!!errors.name} aria-describedby={describedBy('name')} onChange={(event) => setForm({ ...form, name: event.target.value })} />
          {fieldError('name')}
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="contact-email">{t('email')}</Label>
          <Input id="contact-email" type="email" autoComplete="email" required maxLength={120} value={form.email} aria-invalid={!!errors.email} aria-describedby={describedBy('email')} onChange={(event) => setForm({ ...form, email: event.target.value })} />
          {fieldError('email')}
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="contact-phone">{t('phone')}</Label>
        <Input id="contact-phone" type="tel" autoComplete="tel" maxLength={30} value={form.phone} aria-invalid={!!errors.phone} aria-describedby={describedBy('phone')} onChange={(event) => setForm({ ...form, phone: event.target.value })} />
        {fieldError('phone')}
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="contact-subject">{t('subject')}</Label>
        <Input id="contact-subject" required maxLength={150} value={form.subject} aria-invalid={!!errors.subject} aria-describedby={describedBy('subject')} onChange={(event) => setForm({ ...form, subject: event.target.value })} />
        {fieldError('subject')}
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="contact-message">{t('message')}</Label>
        <Textarea id="contact-message" required rows={6} maxLength={5000} value={form.message} aria-invalid={!!errors.message} aria-describedby={describedBy('message')} onChange={(event) => setForm({ ...form, message: event.target.value })} />
        {fieldError('message')}
      </div>
      {/* Honeypot for bots: hidden from people and assistive tech. */}
      <div aria-hidden className="absolute -left-[10000px] h-px w-px overflow-hidden">
        <label htmlFor="contact-website">Website</label>
        <input id="contact-website" tabIndex={-1} autoComplete="off" value={form.website} onChange={(event) => setForm({ ...form, website: event.target.value })} />
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" className="mt-0.5 size-4" checked={form.consent} aria-invalid={!!errors.consent} aria-describedby={describedBy('consent')} onChange={(event) => setForm({ ...form, consent: event.target.checked })} />
          <span>
            {t.rich('consent', {
              privacy: (chunks) => <Link href="/pages/privacy" className="text-primary underline">{chunks}</Link>,
            })}
          </span>
        </label>
        {fieldError('consent')}
      </div>
      {status === 'failed' || status === 'limited' ? (
        <p role="alert" className="text-sm text-destructive">{t(status === 'limited' ? 'errors.limited' : 'errors.failed')}</p>
      ) : null}
      <div className="flex justify-end">
        <Button type="submit" disabled={status === 'sending'}>{status === 'sending' ? t('sending') : t('send')}</Button>
      </div>
    </form>
  );
}
