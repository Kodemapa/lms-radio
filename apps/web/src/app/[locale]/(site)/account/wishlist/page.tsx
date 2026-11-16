import { CourseSummarySchema } from '@obgyn/types';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { z } from 'zod';
import { CourseCard, CourseGrid } from '@/components/course/course-card';
import { Link } from '@/i18n/navigation';
import { apiGet } from '@/lib/server-api';

export default async function WishlistPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const [t, courses] = await Promise.all([
    getTranslations('Account'),
    apiGet('/users/me/wishlist', z.array(CourseSummarySchema), { auth: true }),
  ]);
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold md:text-3xl">{t('wishlistTitle')}</h1>
      {courses.length === 0 ? (
        <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-border bg-card p-10 text-center">
          <p className="text-muted-foreground">{t('wishlistEmpty')}</p>
          <Link href="/courses" className="rounded-[4px] bg-primary px-5 py-2.5 font-medium text-primary-foreground">{t('browse')}</Link>
        </div>
      ) : (
        <CourseGrid>
          {courses.map((course) => (
            <li key={course.id}>
              <CourseCard course={course} wishlisted />
            </li>
          ))}
        </CourseGrid>
      )}
    </div>
  );
}
