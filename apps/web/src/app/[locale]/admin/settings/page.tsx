import { AdminMailStatusSchema, SiteSettingsSchema } from '@obgyn/types';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { MailSettingsPanel } from '@/components/admin/mail-settings-panel';
import { SiteSettingsForm } from '@/components/admin/site-settings-form';
import { requireAdmin } from '@/lib/admin-server';
import { apiGet } from '@/lib/server-api';

export default async function AdminSettingsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireAdmin(locale, '/admin/settings');
  const [t, settings, mail] = await Promise.all([
    getTranslations('Admin.settings'),
    apiGet('/admin/content/settings', SiteSettingsSchema, { auth: true }),
    // The site settings still work if the mail status can't be loaded.
    apiGet('/admin/mail', AdminMailStatusSchema, { auth: true }).catch(() => null),
  ]);
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold md:text-3xl">{t('title')}</h1>
      </div>
      <SiteSettingsForm initial={settings} />
      <MailSettingsPanel status={mail} />
    </div>
  );
}
