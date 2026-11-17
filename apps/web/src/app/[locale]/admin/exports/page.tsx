import { InstructorCourseRowSchema } from '@obgyn/types';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { z } from 'zod';
import { ExportPanel } from '@/components/admin/export-panel';
import { requireAdmin } from '@/lib/admin-server';
import { apiGet } from '@/lib/server-api';

export default async function AdminExportsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireAdmin(locale, '/admin/exports');
  const t = await getTranslations('Admin.exports');
  // For an admin this lists every course.
  const courses = await apiGet('/instructor/courses', z.array(InstructorCourseRowSchema), { auth: true });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold md:text-3xl">{t('title')}</h1>
        <p className="text-muted-foreground">{t('intro')}</p>
      </div>
      <ExportPanel courses={courses.map((course) => ({ id: course.id, title: course.title }))} />
    </div>
  );
}
