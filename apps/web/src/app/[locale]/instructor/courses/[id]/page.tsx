import { InstructorCourseSchema } from '@obgyn/types';
import { setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { CourseEditor } from '@/components/instructor/editor/course-editor';
import { getCategories } from '@/lib/catalog';
import { ApiError, apiGet } from '@/lib/server-api';
import { requireInstructor } from '@/lib/instructor-server';

export default async function EditCoursePage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  // Pages render alongside the layout, so each checks the role before calling the API.
  await requireInstructor(locale, '/instructor/courses');
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [course, categories] = await Promise.all([
    apiGet(`/instructor/courses/${id}`, InstructorCourseSchema, { auth: true }).catch((error) => {
      if (error instanceof ApiError && (error.status === 404 || error.status === 403)) notFound();
      throw error;
    }),
    getCategories(),
  ]);
  return <CourseEditor key={course.id} initial={course} categories={categories} />;
}
