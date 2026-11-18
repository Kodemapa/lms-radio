import { ADMIN_DEFAULT_PAGE_SIZE, ADMIN_PAGE_SIZE_COOKIE, ContactMessageListSchema, ContactStatusSchema } from '@obgyn/types';
import { AdminPager } from '@obgyn/ui';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { ContactInbox } from '@/components/admin/contact-inbox';
import { Link } from '@/i18n/navigation';
import { requireAdmin } from '@/lib/admin-server';
import { rememberedPageSize } from '@/lib/admin-page-size';
import { apiGet } from '@/lib/server-api';
import { pageWindow, PAGE_SIZE_OPTIONS, readPage, withQuery } from '@/lib/admin-paging';

export default async function AdminMessagesPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireAdmin(locale, '/admin/messages');
  const raw = await searchParams;
  const parsed = ContactStatusSchema.safeParse(typeof raw.status === 'string' ? raw.status : undefined);
  const status = parsed.success ? parsed.data : undefined;
  const pageSize = await rememberedPageSize(raw.pageSize, ADMIN_DEFAULT_PAGE_SIZE);
  const page = readPage(raw.page);
  const [t, tAdmin, list] = await Promise.all([
    getTranslations('Admin.inbox'),
    getTranslations('Admin'),
    apiGet(withQuery('/admin/content/contact', { status, page, pageSize }), ContactMessageListSchema, { auth: true }),
  ]);
  const info = pageWindow(list.total, list.page, pageSize);
  const href = (changes: { status?: string; page?: number }) =>
    withQuery('/admin/messages', { status: 'status' in changes ? changes.status : status, page: changes.page, pageSize });
  const tabs = [
    { href: href({ status: undefined }), label: t('tabs.all'), active: !status },
    { href: href({ status: 'NEW' }), label: t('tabs.new', { count: list.newCount }), active: status === 'NEW' },
    { href: href({ status: 'HANDLED' }), label: t('tabs.handled'), active: status === 'HANDLED' },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold md:text-3xl">{t('title')}</h1>
        <p className="text-muted-foreground">{t('intro')}</p>
      </div>
      <nav aria-label={t('filter')} className="flex flex-wrap gap-2">
        {tabs.map((tab) => (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={tab.active ? 'page' : undefined}
            className={`rounded-full border px-4 py-1.5 text-sm ${tab.active ? 'border-primary bg-primary-light text-primary' : 'border-border bg-card hover:bg-muted'}`}
          >
            {tab.label}
          </Link>
        ))}
      </nav>
      <ContactInbox key={`${status ?? 'all'}-${info.page}-${pageSize}`} initial={list.items} />
      <AdminPager
        ariaLabel={tAdmin('pages')}
        summary={tAdmin('pageRange', { start: info.start, end: info.end, total: list.total })}
        page={info.page}
        totalPages={info.totalPages}
        previousHref={info.page > 1 ? `/${locale}${href({ page: info.page - 1 })}` : undefined}
        nextHref={info.page < info.totalPages ? `/${locale}${href({ page: info.page + 1 })}` : undefined}
        previousLabel={tAdmin('previous')}
        nextLabel={tAdmin('next')}
        pageSize={{
          action: `/${locale}/admin/messages`,
          value: pageSize,
          options: PAGE_SIZE_OPTIONS,
          label: tAdmin('rowsPerPage'),
          params: status ? { status } : {},
          cookie: ADMIN_PAGE_SIZE_COOKIE,
        }}
      />
    </div>
  );
}
