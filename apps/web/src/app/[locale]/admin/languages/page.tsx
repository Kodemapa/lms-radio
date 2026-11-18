import { ADMIN_DEFAULT_PAGE_SIZE, ContentLocaleSchema, flattenMessages, MessageOverrideSchema, messageArguments } from '@obgyn/types';
import { Button, Input, Label, Select } from '@obgyn/ui';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { z } from 'zod';
import { ListPager } from '@/components/admin/list-pager';
import { MessageOverrideRow } from '@/components/admin/message-override-row';
import { pageWindow, readPage, readPageSize } from '@/lib/admin-paging';
import { Link } from '@/i18n/navigation';
import { requireAdmin } from '@/lib/admin-server';
import { apiGet } from '@/lib/server-api';
import en from '../../../../../messages/en.json';
import hi from '../../../../../messages/hi.json';

const SHIPPED = { en: flattenMessages(en), hi: flattenMessages(hi) };

export default async function AdminLanguagesPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireAdmin(locale, '/admin/languages');
  const raw = await searchParams;
  const language = ContentLocaleSchema.catch('hi').parse(raw.lang);
  const q = typeof raw.q === 'string' ? raw.q.trim().slice(0, 100) : '';
  const editedOnly = raw.edited === '1';

  const [t, overrides] = await Promise.all([
    getTranslations('Admin.languages'),
    apiGet('/admin/content/messages', z.array(MessageOverrideSchema), { auth: true }),
  ]);
  const edited = new Map(overrides.filter((row) => row.locale === language).map((row) => [row.key, row.value]));
  const shipped = SHIPPED[language];
  const needle = q.toLowerCase();

  // English is the source of truth for which keys exist.
  const matches = Object.keys(SHIPPED.en).filter((key) => {
    if (editedOnly && !edited.has(key)) return false;
    if (!needle) return true;
    return [key, SHIPPED.en[key], shipped[key], edited.get(key)].some((text) => text?.toLowerCase().includes(needle));
  });
  const pageSize = readPageSize(raw.pageSize, ADMIN_DEFAULT_PAGE_SIZE);
  const page = pageWindow(matches.length, readPage(raw.page), pageSize);
  const rows = matches.slice(page.offset, page.offset + pageSize);
  const keep: Record<string, string> = { lang: language };
  if (q) keep.q = q;
  if (editedOnly) keep.edited = '1';
  const missing = Object.keys(SHIPPED.en).filter((key) => shipped[key] === undefined).length;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold md:text-3xl">{t('title')}</h1>
        <p className="text-muted-foreground">{t('intro')}</p>
      </div>

      <form method="get" className="grid gap-3 rounded-2xl border border-border bg-card p-4 sm:grid-cols-[10rem_1fr_auto_auto] sm:items-end">
        <input type="hidden" name="pageSize" value={pageSize} />
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="lang">{t('language')}</Label>
          <Select id="lang" name="lang" defaultValue={language}>
            <option value="en">{t('english')}</option>
            <option value="hi">{t('hindi')}</option>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="q">{t('search')}</Label>
          <Input id="q" name="q" type="search" defaultValue={q} placeholder={t('searchPlaceholder')} />
        </div>
        <label className="flex items-center gap-2 pb-2 text-sm">
          <input type="checkbox" name="edited" value="1" defaultChecked={editedOnly} className="size-4" />
          {t('editedOnly')}
        </label>
        <div className="flex gap-2">
          <Button type="submit">{t('apply')}</Button>
          <Link href="/admin/languages" className="rounded-md px-3 py-2 text-sm text-muted-foreground hover:text-primary">{t('clear')}</Link>
        </div>
      </form>

      <p className="text-sm text-muted-foreground" role="status">
        {t('summary', { shown: rows.length, total: matches.length, edited: edited.size })}
        {missing ? ` ${t('missing', { count: missing })}` : ''}
      </p>
      <p className="text-sm text-muted-foreground">{t('rules')}</p>

      {rows.length ? (
        <ul className="flex flex-col gap-3">
          {rows.map((key) => (
            <MessageOverrideRow
              key={`${language}:${key}`}
              locale={language}
              messageKey={key}
              english={SHIPPED.en[key]!}
              shipped={shipped[key] ?? SHIPPED.en[key]!}
              override={edited.get(key) ?? null}
              args={messageArguments(shipped[key] ?? SHIPPED.en[key]!)}
            />
          ))}
        </ul>
      ) : (
        <p className="rounded-2xl border border-dashed border-border bg-card p-10 text-center text-muted-foreground">{t('empty')}</p>
      )}
      {matches.length > 0 ? (
        <ListPager
          locale={locale}
          path="/admin/languages"
          total={matches.length}
          page={page.page}
          pageSize={pageSize}
          params={keep}
        />
      ) : null}
    </div>
  );
}
