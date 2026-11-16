import { getTranslations, setRequestLocale } from 'next-intl/server';
import { NewCourseForm } from '@/components/instructor/new-course-form';
import { requireInstructor } from '@/lib/instructor-server';

export default async function NewCoursePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  // Pages render alongside the layout, so each checks the role before calling the API.
  await requireInstructor(locale, '/instructor/courses/new');
  const t = await getTranslations('Instructor');
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold md:text-3xl">{t('newCourseTitle')}</h1>
        <p className="text-muted-foreground">{t('newCourseIntro')}</p>
      </div>
      <NewCourseForm />
    </div>
  );
}
