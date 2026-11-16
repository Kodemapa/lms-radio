import { getTranslations, setRequestLocale } from 'next-intl/server';
import { CourseSection } from '@/components/home/course-section';
import { Educators } from '@/components/home/educators';
import { Faqs } from '@/components/home/faqs';
import { Hero } from '@/components/home/hero';
import { InstructorCommunity } from '@/components/home/instructor-community';
import { TopCategories } from '@/components/home/top-categories';
import { WhyChooseUs } from '@/components/home/why-choose-us';
import { getCategories, getCourses, getInstructors } from '@/lib/catalog';

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const [t, categories, newest, free, instructors] = await Promise.all([
    getTranslations('Home'),
    getCategories(),
    getCourses({ sort: 'newest', pageSize: 8 }),
    getCourses({ price: 'free', sort: 'popular', pageSize: 4 }),
    getInstructors(),
  ]);

  return (
    <>
      <Hero
        stats={{
          courses: newest?.total ?? 0,
          instructors: instructors.length,
          students: instructors.reduce((sum, i) => sum + i.studentCount, 0),
        }}
      />
      <TopCategories categories={categories} />
      <CourseSection
        id="newest"
        title={t('newestCourses')}
        subtitle={t('newestCoursesSubtitle')}
        href="/courses?sort=newest"
        courses={newest?.items ?? []}
      />
      <WhyChooseUs />
      <CourseSection
        id="free"
        title={t('freeCourses')}
        subtitle={t('freeCoursesSubtitle')}
        href="/courses?price=free"
        courses={free?.items ?? []}
        muted
      />
      <Educators instructors={instructors} />
      <InstructorCommunity />
      <Faqs />
    </>
  );
}
