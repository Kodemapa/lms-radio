import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@obgyn/ui';
import {
  Award,
  BarChart3,
  Check,
  ChevronRight,
  ClipboardCheck,
  Clock,
  FileText,
  Globe,
  Lock,
  MonitorSmartphone,
  PlayCircle,
  Users,
} from 'lucide-react';
import { getFormatter, getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { CourseThumbnail } from '@/components/course/course-thumbnail';
import { EnrollPanel } from '@/components/course/enroll-panel';
import { PreviewDialog } from '@/components/course/preview-dialog';
import { PriceTag } from '@/components/course/price-tag';
import { RatingStars } from '@/components/course/rating-stars';
import { ReviewsSection } from '@/components/course/reviews-section';
import { WishlistButton } from '@/components/course/wishlist-button';
import { Link } from '@/i18n/navigation';
import { getCourse, getEnrollment, getMe, getWishlistIds } from '@/lib/catalog';
import { apiGet } from '@/lib/server-api';
import { EntranceStatusSchema, ReviewListSchema } from '@obgyn/types';
import { formatClock, formatDuration } from '@/lib/format';
import { initials } from '@/lib/initials';

type Props = { params: Promise<{ locale: string; slug: string }> };

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const course = await getCourse(slug);
  if (!course) return {};
  return {
    title: course.metaTitle ?? course.title,
    description: course.metaDescription ?? course.shortDescription,
  };
}

export default async function CoursePage({ params }: Props) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const [course, me] = await Promise.all([getCourse(slug), getMe()]);
  if (!course) notFound();
  const [t, tCommon, tReviews, format, enrolled, wishlist, reviews] = await Promise.all([
    getTranslations('CourseDetail'),
    getTranslations('Common'),
    getTranslations('Reviews'),
    getFormatter(),
    me ? getEnrollment(slug) : Promise.resolve(false),
    getWishlistIds(),
    apiGet(`/courses/${encodeURIComponent(slug)}/reviews`, ReviewListSchema, { auth: !!me }).catch(() => null),
  ]);
  const tEntrance = await getTranslations('Entrance');
  const entrance =
    course.entranceTest && me
      ? await apiGet(`/courses/${encodeURIComponent(slug)}/entrance`, EntranceStatusSchema, { auth: true, onUnauthorized: 'throw' }).catch(() => null)
      : null;
  // Learners who still need the entrance test see it instead of "Enrol".
  const needsEntrance = !!course.entranceTest && !enrolled && me?.role !== 'FACULTY' && me?.role !== 'ADMIN' && !entrance?.passed;
  // Free courses enrol automatically when a lesson is opened (after any entrance test).
  // Nothing opens, previews included, until a required entrance test is passed.
  const canOpen = (isPreview: boolean) =>
    !!me && !needsEntrance && (enrolled || isPreview || course.price.isFree);

  const thumbnail = (
    <CourseThumbnail assetId={course.thumbnailAssetId} title={course.title} seed={course.slug} />
  );

  return (
    <>
      <section className="page-hero">
        <div className="page-hero-orb" aria-hidden />
        <div className="container grid grid-cols-[minmax(0,1fr)] gap-8 lg:grid-cols-[minmax(0,1fr)_380px]">
          <div className="flex flex-col gap-4">
            <nav aria-label={t('breadcrumb')}>
              <ol className="flex w-fit flex-wrap items-center gap-1 rounded-full bg-card/70 px-3 py-1.5 text-sm text-muted-foreground shadow-sm backdrop-blur">
                <li><Link href="/courses" className="font-medium hover:text-primary">{tCommon('courses')}</Link></li>
                {course.category ? (
                  <>
                    <ChevronRight aria-hidden className="size-4 rtl:rotate-180" />
                    <li>
                      <Link href={`/courses?category=${course.category.slug}`} className="font-medium hover:text-primary">
                        {course.category.name}
                      </Link>
                    </li>
                  </>
                ) : null}
              </ol>
            </nav>
            <h1>{course.title}</h1>
            <p className="max-w-2xl text-lg leading-relaxed text-muted-foreground">{course.shortDescription}</p>
            <ul className="flex flex-wrap gap-2 text-sm [&>li]:rounded-full [&>li]:bg-card/80 [&>li]:px-3 [&>li]:py-1.5 [&>li]:shadow-sm">
              {course.rating.average ? (
                <li className="flex items-center gap-1.5">
                  <span className="font-semibold text-rating">{course.rating.average.toFixed(1)}</span>
                  <RatingStars value={course.rating.average} />
                  <span>({tReviews('count', { count: course.rating.count })})</span>
                </li>
              ) : null}
              <li className="flex items-center gap-1.5">
                <Users aria-hidden className="size-4" />
                {t('students', { count: course.studentCount })}
              </li>
              <li className="flex items-center gap-1.5">
                <BarChart3 aria-hidden className="size-4" />
                {tCommon(`level.${course.level}`)}
              </li>
              <li className="flex items-center gap-1.5">
                <Globe aria-hidden className="size-4" />
                {tCommon(`languages.${course.language}` as 'languages.en')}
              </li>
              {course.publishedAt ? (
                <li>{t('lastUpdated', { date: format.dateTime(new Date(course.publishedAt), { dateStyle: 'medium' }) })}</li>
              ) : null}
            </ul>
            {course.instructor ? (
              <Link href={`/instructors/${course.instructor.id}`} className="group flex w-fit items-center gap-3">
                <span className="flex size-11 items-center justify-center rounded-full border-2 border-card bg-gradient-to-br from-[#c9b5ef] to-[#fbc9a1] font-semibold text-[#2f2340] shadow-sm">
                  {initials(course.instructor.displayName)}
                </span>
                <span className="text-sm font-medium group-hover:text-primary">{tCommon('by', { name: course.instructor.displayName })}</span>
              </Link>
            ) : null}
          </div>
        </div>
      </section>

      <div className="container grid grid-cols-[minmax(0,1fr)] gap-8 pb-16 pt-2 lg:grid-cols-[minmax(0,1fr)_380px] lg:pb-24">
        <aside className="order-first lg:order-last lg:-mt-72">
          <div className="surface flex flex-col gap-5 p-4 shadow-lg lg:sticky lg:top-24">
            {course.previewAssetId && me ? (
              <PreviewDialog
                assetId={course.previewAssetId}
                title={course.title}
                label={t('watchPreview')}
                closeLabel={tCommon('close')}
              >
                {thumbnail}
              </PreviewDialog>
            ) : (
              thumbnail
            )}
            <PriceTag price={course.price} locale={locale} freeLabel={tCommon('free')} size="lg" />
            {needsEntrance ? (
              <div className="soft-wash flex flex-col gap-3 rounded-2xl p-4">
                <p className="font-semibold text-primary">{tEntrance('required')}</p>
                <p className="text-sm">
                  {tEntrance('requiredBody', { count: course.entranceTest!.questionCount, pass: course.entranceTest!.passPercent })}
                </p>
                <Link
                  href={me ? `/learn/${course.slug}/entrance` : `/login?next=${encodeURIComponent(`/${locale}/learn/${course.slug}/entrance`)}`}
                  className="flex justify-center rounded-full bg-primary py-3 font-medium text-primary-foreground hover:bg-primary-hover"
                >
                  {me ? tEntrance('takeTest') : tEntrance('signInFirst')}
                </Link>
              </div>
            ) : (
            <EnrollPanel
              slug={course.slug}
              isFree={course.price.isFree}
              signedIn={!!me}
              enrolled={enrolled}
              locale={locale}
            />
            )}
            {wishlist ? (
              <WishlistButton courseId={course.id} initial={wishlist.has(course.id)} variant="labelled" className="w-full" />
            ) : null}
            <div>
              <p className="mb-3 font-semibold">{t('includes')}</p>
              <ul className="flex flex-col gap-2.5 text-sm">
                <li className="flex items-center gap-2.5">
                  <PlayCircle aria-hidden className="size-4 text-primary" />
                  {t('includesLessons', { count: course.lessonCount })}
                </li>
                {course.totalDurationSec > 0 ? (
                  <li className="flex items-center gap-2.5">
                    <Clock aria-hidden className="size-4 text-primary" />
                    {t('includesDuration', { duration: formatDuration(course.totalDurationSec) })}
                  </li>
                ) : null}
                {course.certificateEnabled ? (
                  <li className="flex items-center gap-2.5">
                    <Award aria-hidden className="size-4 text-primary" />
                    {t('includesCertificate')}
                  </li>
                ) : null}
                <li className="flex items-center gap-2.5">
                  <MonitorSmartphone aria-hidden className="size-4 text-primary" />
                  {t('includesAccess')}
                </li>
              </ul>
            </div>
          </div>
        </aside>

        <Tabs defaultValue="overview">
          <TabsList>
            <TabsTrigger value="overview">{t('overview')}</TabsTrigger>
            <TabsTrigger value="curriculum">{t('curriculum')}</TabsTrigger>
            {course.instructor ? <TabsTrigger value="instructor">{t('instructor')}</TabsTrigger> : null}
            <TabsTrigger value="reviews">{tReviews('title')}</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="flex flex-col gap-8">
            {course.learnings.length > 0 ? (
              <section aria-labelledby="learn" className="surface p-6 md:p-8">
                <h2 id="learn" className="mb-4 text-xl font-semibold">{t('whatYoullLearn')}</h2>
                <ul className="grid gap-3 md:grid-cols-2">
                  {course.learnings.map((item) => (
                    <li key={item} className="flex gap-2.5">
                      <Check aria-hidden className="mt-0.5 box-content size-3.5 shrink-0 rounded-full bg-accent p-1 text-white" />
                      {item}
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
            <section aria-labelledby="requirements">
              <h2 id="requirements" className="mb-3 text-xl font-semibold">{t('requirements')}</h2>
              {course.requirements.length > 0 ? (
                <ul className="list-disc space-y-1.5 ps-5">
                  {course.requirements.map((item) => <li key={item}>{item}</li>)}
                </ul>
              ) : (
                <p className="text-muted-foreground">{t('noRequirements')}</p>
              )}
            </section>
            {course.description ? (
              <section aria-labelledby="about">
                <h2 id="about" className="mb-3 text-xl font-semibold">{t('description')}</h2>
                <div className="whitespace-pre-line leading-relaxed text-muted-foreground">{course.description}</div>
              </section>
            ) : null}
            {course.tags.length > 0 ? (
              <section aria-labelledby="tags">
                <h2 id="tags" className="mb-3 text-xl font-semibold">{t('tags')}</h2>
                <ul className="flex flex-wrap gap-2">
                  {course.tags.map((tag) => (
                    <li key={tag}>
                      <Link href={`/courses?q=${encodeURIComponent(tag)}`} className="rounded-full bg-primary-light px-3 py-1 text-sm text-primary hover:underline">
                        {tag}
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
          </TabsContent>

          <TabsContent value="curriculum">
            <p className="mb-4 text-sm text-muted-foreground">
              {t('chapters', { count: course.chapters.length })} · {t('includesLessons', { count: course.lessonCount })}
              {course.totalDurationSec > 0 ? ` · ${formatDuration(course.totalDurationSec)}` : ''}
            </p>
            {course.entranceTest ? (
              <Link
                href={me ? `/learn/${course.slug}/entrance` : `/login?next=${encodeURIComponent(`/${locale}/learn/${course.slug}/entrance`)}`}
                className="soft-wash mb-4 flex items-center gap-3 rounded-2xl px-5 py-4 text-sm transition-shadow hover:shadow-md"
              >
                <ClipboardCheck aria-hidden className="size-5 shrink-0 text-primary" />
                <span className="flex-1 font-medium text-primary">{tEntrance('title')}</span>
                <span className="text-muted-foreground">
                  {tEntrance('rules', { count: course.entranceTest.questionCount, pass: course.entranceTest.passPercent })}
                </span>
              </Link>
            ) : null}
            <Accordion type="multiple" defaultValue={course.chapters[0] ? [course.chapters[0].id] : []} className="flex flex-col gap-3">
              {course.chapters.map((chapter) => (
                <AccordionItem key={chapter.id} value={chapter.id}>
                  <AccordionTrigger>
                    <span className="flex flex-1 flex-wrap items-center justify-between gap-2 pe-2">
                      <span>{chapter.title}</span>
                      <span className="text-sm font-normal text-muted-foreground">
                        {tCommon('lessons', { count: chapter.lessons.length })}
                      </span>
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className="p-0">
                    <ul className="divide-y divide-border">
                      {chapter.lessons.map((lesson) => {
                        const Icon = lesson.kind === 'PDF' ? FileText : PlayCircle;
                        const body = (
                          <>
                            <Icon aria-hidden className="size-4 shrink-0 text-primary" />
                            <span className="flex-1">{lesson.title}</span>
                            {lesson.isPreview ? (
                              <span className="rounded-full bg-primary-light px-2 py-0.5 text-xs text-primary">{t('preview')}</span>
                            ) : null}
                            {lesson.durationSec ? (
                              <span className="text-sm text-muted-foreground">{formatClock(lesson.durationSec)}</span>
                            ) : null}
                            {!canOpen(lesson.isPreview) ? <Lock aria-hidden className="size-4 text-muted-foreground" /> : null}
                          </>
                        );
                        return (
                          <li key={lesson.id}>
                            {canOpen(lesson.isPreview) ? (
                              <Link href={`/learn/${course.slug}/${lesson.id}`} className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-primary-light/60">
                                {body}
                              </Link>
                            ) : (
                              <div className="flex items-center gap-3 px-5 py-3">{body}</div>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </TabsContent>

          {course.instructor ? (
            <TabsContent value="instructor">
              <Link href={`/instructors/${course.instructor.id}`} className="surface lift flex items-center gap-4 p-6">
                <span className="flex size-16 items-center justify-center rounded-full bg-gradient-to-br from-[#c9b5ef] to-[#fbc9a1] text-xl font-bold text-[#2f2340]">
                  {initials(course.instructor.displayName)}
                </span>
                <span className="flex flex-col">
                  <span className="text-lg font-semibold">{course.instructor.displayName}</span>
                  {course.instructor.headline ? (
                    <span className="text-muted-foreground">{course.instructor.headline}</span>
                  ) : null}
                </span>
              </Link>
            </TabsContent>
          ) : null}

          <TabsContent value="reviews">
            {reviews ? <ReviewsSection slug={course.slug} reviews={reviews} canReview={enrolled} /> : null}
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}
