'use client';

import { FaqInputSchema, type Faq, type FaqInput } from '@obgyn/types';
import { Button, Input, Textarea, toast } from '@obgyn/ui';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { type FormEvent, useState } from 'react';
import { ConfirmDialog } from '@/components/instructor/confirm-dialog';
import { ApiClientError, api } from '@/lib/instructor-api';
import { RequiredLabel } from './required-label';

type FaqForm = FaqInput & { id: string | null };
const EMPTY: FaqForm = { id: null, locale: 'en', question: '', answer: '', position: 0, published: true };

export function FaqsManager({ initial }: { initial: Faq[] }) {
  const t = useTranslations('Admin.faqs');
  const tCommon = useTranslations('Common');
  const [faqs, setFaqs] = useState(initial);
  const [form, setForm] = useState<FaqForm | null>(null);
  const [deleting, setDeleting] = useState<Faq | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  // English only (older Hindi FAQs stay in the database, unused).
  const refresh = async () => setFaqs((await api<Faq[]>('GET', 'admin/content/faqs')).filter((faq) => faq.locale === 'en'));

  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (!form) return;
    const parsed = FaqInputSchema.safeParse({
      locale: form.locale,
      question: form.question,
      answer: form.answer,
      position: Number(form.position),
      published: form.published,
    });
    if (!parsed.success) {
      setError(parsed.error.issues.map((issue) => issue.message).join(' '));
      return;
    }
    setPending(true);
    setError(null);
    try {
      if (form.id) await api('PATCH', `admin/content/faqs/${form.id}`, parsed.data);
      else await api('POST', 'admin/content/faqs', parsed.data);
      await refresh();
      setForm(null);
      toast.success(t('saved'));
    } catch (requestError) {
      const code = requestError instanceof ApiClientError ? requestError.body?.code : undefined;
      setError(code === 'PCPNDT_BLOCKED' ? tCommon('pcpndt') : t('errors.failed'));
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex justify-end">
        <Button onClick={() => { setError(null); setForm({ ...EMPTY }); }}>
          <Plus aria-hidden className="size-4" />
          {t('add')}
        </Button>
      </div>
      {error && !form ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
      {faqs.length ? (
        <ol className="flex flex-col gap-2">
          {faqs.map((faq) => (
            <li key={faq.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-4">
              <div className="min-w-0 flex-1">
                <p className="font-medium">{faq.question}</p>
                <p className="text-sm text-muted-foreground">{faq.locale} · {t('positionLabel', { position: faq.position })} · {faq.published ? t('published') : t('draft')}</p>
              </div>
              <Button size="sm" variant="ghost" aria-label={t('edit', { question: faq.question })} onClick={() => {
                setError(null);
                // English FAQs only (see refresh above).
                setForm({ id: faq.id, locale: 'en', question: faq.question, answer: faq.answer, position: faq.position, published: faq.published });
              }}>
                <Pencil aria-hidden className="size-4" />
              </Button>
              <Button size="sm" variant="ghost" aria-label={t('delete', { question: faq.question })} onClick={() => setDeleting(faq)}>
                <Trash2 aria-hidden className="size-4" />
              </Button>
            </li>
          ))}
        </ol>
      ) : (
        <p className="rounded-2xl border border-dashed border-border bg-card p-10 text-center text-muted-foreground">{t('empty')}</p>
      )}
      {form ? (
        <form onSubmit={save} noValidate className="surface flex flex-col gap-4 p-5">
          <h2 className="text-lg font-semibold">{form.id ? t('editTitle') : t('addTitle')}</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <RequiredLabel htmlFor="faq-position">{t('position')}</RequiredLabel>
              <Input id="faq-position" type="number" min={0} max={10000} required value={form.position} onChange={(event) => setForm({ ...form, position: Number(event.target.value) })} />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <RequiredLabel htmlFor="faq-question">{t('question')}</RequiredLabel>
            <Input id="faq-question" required maxLength={300} value={form.question} onChange={(event) => setForm({ ...form, question: event.target.value })} />
          </div>
          <div className="flex flex-col gap-1.5">
            <RequiredLabel htmlFor="faq-answer">{t('answer')}</RequiredLabel>
            <Textarea id="faq-answer" required maxLength={5000} rows={6} value={form.answer} onChange={(event) => setForm({ ...form, answer: event.target.value })} />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" className="size-4" checked={form.published} onChange={(event) => setForm({ ...form, published: event.target.checked })} />
            {t('published')}
          </label>
          {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="outline" disabled={pending} onClick={() => setForm(null)}>{tCommon('cancel')}</Button>
            <Button type="submit" disabled={pending}>{pending ? tCommon('saving') : tCommon('save')}</Button>
          </div>
        </form>
      ) : null}
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={t('deleteTitle', { question: deleting?.question ?? '' })}
        body={t('deleteBody')}
        confirmLabel={tCommon('delete')}
        onConfirm={async () => {
          if (!deleting) return;
          try {
            await api('DELETE', `admin/content/faqs/${deleting.id}`);
            await refresh();
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
