import { InstructorCourseRowSchema } from '@obgyn/types';
import { Plus } from 'lucide-react';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { z } from 'zod';
import { CoursesTable } from '@/components/instructor/courses-table';
import { Link } from '@/i18n/navigation';
import { apiGet } from '@/lib/server-api';
import { requireInstructor } from '@/lib/instructor-server';

export default async function InstructorCoursesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  // Pages render alongside the layout, so each checks the role before calling the API.
  await requireInstructor(locale, '/instructor/courses');
  const [t, courses] = await Promise.all([
    getTranslations('Instructor'),
    apiGet('/instructor/courses', z.array(InstructorCourseRowSchema), { auth: true }),
  ]);
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold md:text-3xl">{t('coursesTitle')}</h1>
        <Link href="/instructor/courses/new" className="flex items-center gap-2 rounded-full bg-primary px-4 py-2.5 font-medium text-primary-foreground hover:bg-primary-hover">
          <Plus aria-hidden className="size-4" />
          {t('nav.newCourse')}
        </Link>
      </div>
      {courses.length > 0 ? (
        <CoursesTable courses={courses} />
      ) : (
        <p className="soft-wash rounded-3xl p-10 text-center text-muted-foreground">
          {t('noCourses')}
        </p>
      )}
    </div>
  );
}
