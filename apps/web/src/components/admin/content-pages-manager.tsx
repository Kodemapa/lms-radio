'use client';

import {
  ContentPageInputSchema,
  type ContentPage,
  type ContentPageInput,
  type ContentLocale,
} from '@obgyn/types';
import { Button, Input, Select, Textarea } from '@obgyn/ui';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { type FormEvent, useState } from 'react';
import { ConfirmDialog } from '@/components/instructor/confirm-dialog';
import { ApiClientError, api } from '@/lib/instructor-api';
import { RequiredLabel } from './required-label';

type PageForm = ContentPageInput & { id: string | null };
const EMPTY: PageForm = {
  id: null,
  slug: '',
  locale: 'en',
  title: '',
  body: '',
  published: false,
};

export function ContentPagesManager({ initial }: { initial: ContentPage[] }) {
  const t = useTranslations('Admin.contentPages');
  const tCommon = useTranslations('Common');
  const [pages, setPages] = useState(initial);
  const [form, setForm] = useState<PageForm | null>(null);
  const [deleting, setDeleting] = useState<ContentPage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const refresh = async () => setPages(await api<ContentPage[]>('GET', 'admin/content/pages'));

  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (!form) return;
    const parsed = ContentPageInputSchema.safeParse({
      slug: form.slug,
      locale: form.locale,
      title: form.title,
      body: form.body,
      published: form.published,
    });
    if (!parsed.success) {
      setError(parsed.error.issues.map((issue) => issue.message).join(' '));
      return;
    }

    setPending(true);
    setError(null);
    try {
      if (form.id) await api('PATCH', `admin/content/pages/${form.id}`, parsed.data);
      else await api('POST', 'admin/content/pages', parsed.data);
      await refresh();
      setForm(null);
      setStatus(t('saved'));
    } catch (requestError) {
      const code = requestError instanceof ApiClientError ? requestError.body?.code : undefined;
      setError(
        code === 'PAGE_EXISTS'
          ? t('errors.exists')
          : code === 'PCPNDT_BLOCKED'
            ? tCommon('pcpndt')
            : t('errors.failed'),
      );
    } finally {
      setPending(false);
    }
  };

  const edit = (page: ContentPage) => {
    setError(null);
    setForm({ id: page.id, slug: page.slug, locale: page.locale, title: page.title, body: page.body, published: page.published });
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex justify-end">
        <Button onClick={() => { setError(null); setForm({ ...EMPTY }); }}>
          <Plus aria-hidden className="size-4" />
          {t('add')}
        </Button>
      </div>
      {status ? <p role="status" aria-live="polite" className="text-sm">{status}</p> : null}
      {error && !form ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
      {pages.length ? (
        <ul className="flex flex-col gap-2">
          {pages.map((page) => (
            <li key={page.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-4">
              <div className="min-w-0 flex-1">
                <p className="font-medium">{page.title}</p>
                <p className="text-sm text-muted-foreground">
                  <span className="font-mono">{page.slug}</span> · {page.locale} · {page.published ? t('published') : t('draft')}
                </p>
              </div>
              <Button size="sm" variant="ghost" aria-label={t('edit', { title: page.title })} onClick={() => edit(page)}>
                <Pencil aria-hidden className="size-4" />
              </Button>
              <Button size="sm" variant="ghost" aria-label={t('delete', { title: page.title })} onClick={() => setDeleting(page)}>
                <Trash2 aria-hidden className="size-4" />
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-2xl border border-dashed border-border bg-card p-10 text-center text-muted-foreground">{t('empty')}</p>
      )}
      {form ? (
        <form onSubmit={save} noValidate className="surface flex flex-col gap-4 p-5">
          <h2 className="text-lg font-semibold">{form.id ? t('editTitle') : t('addTitle')}</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <RequiredLabel htmlFor="content-page-slug">{t('slug')}</RequiredLabel>
              <Input id="content-page-slug" required maxLength={80} value={form.slug} onChange={(event) => setForm({ ...form, slug: event.target.value })} />
            </div>
            <div className="flex flex-col gap-1.5">
              <RequiredLabel htmlFor="content-page-locale">{t('language')}</RequiredLabel>
              <Select
                id="content-page-locale"
                required
                value={form.locale}
                onChange={(event) => setForm({ ...form, locale: event.target.value as ContentLocale })}
              >
                <option value="en">{t('english')}</option>
                <option value="hi">{t('hindi')}</option>
              </Select>
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <RequiredLabel htmlFor="content-page-title">{t('titleLabel')}</RequiredLabel>
            <Input id="content-page-title" required maxLength={150} value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} />
          </div>
          <div className="flex flex-col gap-1.5">
            <RequiredLabel htmlFor="content-page-body">{t('body')}</RequiredLabel>
            <Textarea id="content-page-body" required maxLength={50000} rows={12} value={form.body} onChange={(event) => setForm({ ...form, body: event.target.value })} />
            <p className="text-xs text-muted-foreground">{t('bodyHint')}</p>
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
        title={t('deleteTitle', { title: deleting?.title ?? '' })}
        body={t('deleteBody')}
        confirmLabel={tCommon('delete')}
        onConfirm={async () => {
          if (!deleting) return;
          try {
            await api('DELETE', `admin/content/pages/${deleting.id}`);
            await refresh();
            setStatus(t('deleted'));
            setDeleting(null);
          } catch {
            setError(t('errors.failed'));
          }
        }}
      />
    </div>
  );
}
