import { type CourseSummary } from '@obgyn/types';
import { getTranslations } from 'next-intl/server';
import { getWishlistIds } from '@/lib/catalog';
import { CourseCard, CourseGrid } from '../course/course-card';
import { SectionHeading } from './section-heading';

export async function CourseSection({
  id,
  title,
  subtitle,
  href,
  courses,
  muted = false,
}: {
  id: string;
  title: string;
  subtitle: string;
  href: string;
  courses: CourseSummary[];
  muted?: boolean;
}) {
  const [t, wishlist] = await Promise.all([getTranslations('Common'), getWishlistIds()]);
  if (courses.length === 0) return null;
  return (
    <section aria-labelledby={id} className={`section-gap ${muted ? 'bg-section' : ''}`}>
      <div className="container">
        <SectionHeading id={id} title={title} subtitle={subtitle} href={href} linkLabel={t('viewAll')} />
        <CourseGrid>
          {courses.map((course) => (
            <li key={course.id}>
              <CourseCard course={course} wishlisted={wishlist ? wishlist.has(course.id) : undefined} />
            </li>
          ))}
        </CourseGrid>
      </div>
    </section>
  );
}
