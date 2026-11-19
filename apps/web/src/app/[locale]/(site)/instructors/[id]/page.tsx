import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { CourseCard, CourseGrid } from '@/components/course/course-card';
import { getCourses, getInstructor, getWishlistIds } from '@/lib/catalog';
import { AvatarContent } from '@/components/account/avatar';

type Props = { params: Promise<{ locale: string; id: string }> };

export async function generateMetadata({ params }: Props) {
  const { id } = await params;
  const instructor = /^[0-9a-f-]{36}$/i.test(id) ? await getInstructor(id) : null;
  return instructor ? { title: instructor.displayName, description: instructor.headline } : {};
}

export default async function InstructorPage({ params }: Props) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [instructor, courses, t, tCommon, wishlist] = await Promise.all([
    getInstructor(id),
    getCourses({ instructor: id, pageSize: 24 }),
    getTranslations('Instructors'),
    getTranslations('Common'),
    getWishlistIds(),
  ]);
  if (!instructor) notFound();

  return (
    <>
      <section className="bg-secondary py-10 text-secondary-foreground md:py-14">
        <div className="container flex flex-col items-start gap-6 md:flex-row md:items-center">
          <span className="flex size-24 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white/15 text-3xl font-bold">
            <AvatarContent name={instructor.displayName} assetId={instructor.avatarAssetId} />
          </span>
          <div className="flex flex-col gap-2">
            <h1 className="text-3xl font-bold md:text-4xl">{instructor.displayName}</h1>
            {instructor.headline ? <p className="text-lg opacity-85">{instructor.headline}</p> : null}
            <p className="flex gap-4 text-sm opacity-80">
              <span>{tCommon('coursesCount', { count: instructor.courseCount })}</span>
              <span>{tCommon('students', { count: instructor.studentCount })}</span>
            </p>
          </div>
        </div>
      </section>
      <div className="container flex flex-col gap-8 py-8 lg:py-12">
        {instructor.bio ? <p className="max-w-3xl whitespace-pre-line leading-relaxed">{instructor.bio}</p> : null}
        <section aria-labelledby="courses-by" className="flex flex-col gap-6">
          <h2 id="courses-by" className="section-title">
            {t('coursesBy', { name: instructor.displayName })}
          </h2>
          <CourseGrid>
            {(courses?.items ?? []).map((course) => (
              <li key={course.id}>
                <CourseCard course={course} wishlisted={wishlist ? wishlist.has(course.id) : undefined} />
              </li>
            ))}
          </CourseGrid>
        </section>
      </div>
    </>
  );
}
