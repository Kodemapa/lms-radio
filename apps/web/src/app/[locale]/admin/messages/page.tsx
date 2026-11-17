import { ContactMessageListSchema, ContactStatusSchema } from '@obgyn/types';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { ContactInbox } from '@/components/admin/contact-inbox';
import { Link } from '@/i18n/navigation';
import { requireAdmin } from '@/lib/admin-server';
import { apiGet } from '@/lib/server-api';

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
  const raw = (await searchParams).status;
  const parsed = ContactStatusSchema.safeParse(typeof raw === 'string' ? raw : undefined);
  const status = parsed.success ? parsed.data : undefined;
  const [t, list] = await Promise.all([
    getTranslations('Admin.inbox'),
    apiGet(`/admin/content/contact${status ? `?status=${status}` : ''}`, ContactMessageListSchema, { auth: true }),
  ]);
  const tabs = [
    { href: '/admin/messages', label: t('tabs.all'), active: !status },
    { href: '/admin/messages?status=NEW', label: t('tabs.new', { count: list.newCount }), active: status === 'NEW' },
    { href: '/admin/messages?status=HANDLED', label: t('tabs.handled'), active: status === 'HANDLED' },
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
      <ContactInbox key={status ?? 'all'} initial={list.items} />
    </div>
  );
}
