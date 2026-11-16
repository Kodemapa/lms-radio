import { getTranslations, setRequestLocale } from 'next-intl/server';
import { CourseSection } from '@/components/home/course-section';
import { Difference } from '@/components/home/difference';
import { Educators } from '@/components/home/educators';
import { Faqs } from '@/components/home/faqs';
import { FetalPathways } from '@/components/home/fetal-pathways';
import { Hero } from '@/components/home/hero';
import { ImageCredits } from '@/components/home/image-credits';
import { InstructorCommunity } from '@/components/home/instructor-community';
import { PracticeBand } from '@/components/home/practice-band';
import { TopicMarquee } from '@/components/home/topic-marquee';
import { WhyChooseUs } from '@/components/home/why-choose-us';
import { getCourses, getInstructors } from '@/lib/catalog';
import '@/components/home/home.css';

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const [t, newest, free, instructors] = await Promise.all([
    getTranslations('Home'),
    getCourses({ sort: 'newest', pageSize: 4 }),
    getCourses({ price: 'free', sort: 'popular', pageSize: 4 }),
    getInstructors(),
  ]);

  return (
    <div className="clinical-home">
      <div className="lp-progress" aria-hidden />
      <Hero
        stats={{
          courses: newest?.total ?? 0,
          instructors: instructors.length,
          students: instructors.reduce((sum, i) => sum + i.studentCount, 0),
        }}
      />
      <TopicMarquee />
      <Difference />
      <FetalPathways />
      <WhyChooseUs />
      <CourseSection
        id="newest"
        title={t('newestCourses')}
        subtitle={t('newestCoursesSubtitle')}
        href="/courses?sort=newest"
        courses={newest?.items ?? []}
      />
      <PracticeBand />
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
      <ImageCredits />
    </div>
  );
}
