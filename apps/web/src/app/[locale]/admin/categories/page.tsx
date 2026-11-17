import { AdminCategorySchema } from '@obgyn/types';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { z } from 'zod';
import { CategoryManager } from '@/components/admin/category-manager';
import { requireAdmin } from '@/lib/admin-server';
import { apiGet } from '@/lib/server-api';

export default async function AdminCategoriesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireAdmin(locale, '/admin/categories');
  const t = await getTranslations('Admin.categories');
  const categories = await apiGet('/admin/categories', z.array(AdminCategorySchema), { auth: true });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold md:text-3xl">{t('title')}</h1>
        <p className="text-muted-foreground">{t('intro')}</p>
      </div>
      <CategoryManager initial={categories} />
    </div>
  );
}
