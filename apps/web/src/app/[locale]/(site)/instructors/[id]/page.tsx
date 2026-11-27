import { BookOpen, Users } from 'lucide-react';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { CourseCard, CourseGrid } from '@/components/course/course-card';
import { getCourses, getInstructor, getWishlistIds } from '@/lib/catalog';
import { AvatarContent } from '@/components/account/avatar';
import { Link } from '@/i18n/navigation';

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
    getCourses({ instructor: id, pageSize: 24 }, true),
    getTranslations('Instructors'),
    getTranslations('Common'),
    getWishlistIds(),
  ]);
  if (!instructor) notFound();
  const items = courses?.items ?? [];

  return (
    <>
      {/* Same hero as the other inner pages: theme-aware glow, readable in light and dark. */}
      <section className="page-hero">
        <div className="page-hero-orb" aria-hidden />
        <div className="container flex flex-col gap-6">
          <nav aria-label={t('title')}>
            <Link
              href="/instructors"
              className="w-fit rounded-full bg-card/70 px-3 py-1.5 text-sm font-medium text-muted-foreground shadow-sm backdrop-blur hover:text-primary"
            >
              ← {t('title')}
            </Link>
          </nav>
          <div className="flex flex-col items-start gap-5 sm:flex-row sm:items-center">
            <span className="flex size-24 shrink-0 items-center justify-center overflow-hidden rounded-full border-4 border-card bg-gradient-to-br from-[#c9b5ef] to-[#fbc9a1] text-3xl font-bold text-[#2f2340] shadow-md md:size-28">
              <AvatarContent name={instructor.displayName} assetId={instructor.avatarAssetId} />
            </span>
            <div className="flex min-w-0 flex-col gap-2">
              <p className="kicker">{t('kicker')}</p>
              <h1 className="break-words">{instructor.displayName}</h1>
              {instructor.headline ? (
                <p className="max-w-2xl text-lg leading-relaxed text-muted-foreground">{instructor.headline}</p>
              ) : null}
            </div>
          </div>
          <ul className="flex flex-wrap gap-3">
            <li className="surface flex items-center gap-3 px-4 py-3">
              <BookOpen aria-hidden className="size-5 text-primary" />
              <span className="font-semibold">{tCommon('coursesCount', { count: instructor.courseCount })}</span>
            </li>
            <li className="surface flex items-center gap-3 px-4 py-3">
              <Users aria-hidden className="size-5 text-primary" />
              <span className="font-semibold">{tCommon('students', { count: instructor.studentCount })}</span>
            </li>
          </ul>
        </div>
      </section>

      <div className="container flex flex-col gap-10 pb-16 pt-2 lg:pb-24">
        {instructor.bio ? (
          <section aria-labelledby="about-instructor" className="surface p-6 md:p-8">
            <h2 id="about-instructor" className="mb-3 text-xl font-semibold">
              {t('about')}
            </h2>
            <p className="max-w-3xl whitespace-pre-line leading-relaxed text-muted-foreground">{instructor.bio}</p>
          </section>
        ) : null}
        <section aria-labelledby="courses-by" className="flex flex-col gap-6">
          <h2 id="courses-by" className="section-title">
            {t('coursesBy', { name: instructor.displayName })}
          </h2>
          {items.length ? (
            <CourseGrid>
              {items.map((course) => (
                <li key={course.id}>
                  <CourseCard course={course} wishlisted={wishlist ? wishlist.has(course.id) : undefined} />
                </li>
              ))}
            </CourseGrid>
          ) : (
            <p className="soft-wash rounded-3xl p-10 text-center text-muted-foreground">{t('noCourses')}</p>
          )}
        </section>
      </div>
    </>
  );
}
