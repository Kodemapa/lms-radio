import { FaqSchema } from '@obgyn/types';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { z } from 'zod';
import { FaqsManager } from '@/components/admin/faqs-manager';
import { requireAdmin } from '@/lib/admin-server';
import { apiGet } from '@/lib/server-api';

export default async function AdminFaqsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireAdmin(locale, '/admin/faqs');
  const [t, faqs] = await Promise.all([
    getTranslations('Admin.faqs'),
    apiGet('/admin/content/faqs', z.array(FaqSchema), { auth: true }),
  ]);
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold md:text-3xl">{t('title')}</h1>
        <p className="text-muted-foreground">{t('intro')}</p>
      </div>
      {/* English only: older Hindi FAQs stay in the database but are no longer shown or used. */}
      <FaqsManager initial={faqs.filter((faq) => faq.locale === 'en')} />
    </div>
  );
}
