import { ApplicationFieldSchema } from '@obgyn/types';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { z } from 'zod';
import { ApplicationFieldsManager } from '@/components/admin/application-fields-manager';
import { requireAdmin } from '@/lib/admin-server';
import { apiGet } from '@/lib/server-api';

export default async function AdminApplicationFieldsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireAdmin(locale, '/admin/application-fields');
  const t = await getTranslations('Admin.formFields');
  const fields = await apiGet('/admin/application-fields', z.array(ApplicationFieldSchema), { auth: true });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold md:text-3xl">{t('title')}</h1>
        <p className="text-muted-foreground">{t('intro')}</p>
      </div>
      <ApplicationFieldsManager initial={fields} />
    </div>
  );
}
