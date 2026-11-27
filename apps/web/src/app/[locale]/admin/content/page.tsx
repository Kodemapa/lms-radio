import { ContentPageSchema } from '@obgyn/types';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { z } from 'zod';
import { ContentPagesManager } from '@/components/admin/content-pages-manager';
import { requireAdmin } from '@/lib/admin-server';
import { apiGet } from '@/lib/server-api';

export default async function AdminContentPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireAdmin(locale, '/admin/content');
  const [t, pages] = await Promise.all([
    getTranslations('Admin.contentPages'),
    apiGet('/admin/content/pages', z.array(ContentPageSchema), { auth: true }),
  ]);
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold md:text-3xl">{t('title')}</h1>
        <p className="text-muted-foreground">{t('intro')}</p>
      </div>
      {/* English only: older Hindi page drafts stay in the database but are no longer shown or used. */}
      <ContentPagesManager initial={pages.filter((page) => page.locale === 'en')} />
    </div>
  );
}
