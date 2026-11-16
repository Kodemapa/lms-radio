import { type CourseSummary } from '@obgyn/types';
import { Clock, PlayCircle, Star } from 'lucide-react';
import { getLocale, getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { formatDuration } from '@/lib/format';
import { CourseThumbnail } from './course-thumbnail';
import { PriceTag } from './price-tag';
import { WishlistButton } from './wishlist-button';

/**
 * Course card in the previous site's style: rounded image, bookmark, category
 * pill, rating, price row. `wishlisted` is undefined when signed out (no bookmark).
 */
export async function CourseCard({ course, wishlisted }: { course: CourseSummary; wishlisted?: boolean }) {
  const [t, locale] = await Promise.all([getTranslations('Common'), getLocale()]);
  return (
    <div className="relative h-full">
    <Link
      href={`/courses/${course.slug}`}
      className="group flex h-full flex-col gap-4 rounded-2xl border border-border bg-card p-3 transition-shadow hover:shadow-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring md:p-4"
    >
      <CourseThumbnail assetId={course.thumbnailAssetId} title={course.title} seed={course.slug} />
      <div className="flex flex-1 flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          {course.category ? (
            <span className="truncate rounded-full bg-primary-light px-3 py-1 text-sm text-primary">
              {course.category.name}
            </span>
          ) : (
            <span />
          )}
          {course.rating.average ? (
            <span className="flex shrink-0 items-center gap-1 text-sm">
              <Star aria-hidden className="size-4 fill-rating text-rating" />
              <span className="font-semibold">{course.rating.average.toFixed(1)}</span>
              <span className="text-muted-foreground">({course.rating.count})</span>
            </span>
          ) : (
            <span className="shrink-0 text-xs text-muted-foreground">{t(`level.${course.level}`)}</span>
          )}
        </div>
        <h3 className="line-clamp-2 min-h-12 font-semibold leading-6 transition-colors group-hover:text-primary">
          {course.title}
        </h3>
        {course.instructor ? (
          <p className="truncate text-sm text-muted-foreground">{course.instructor.displayName}</p>
        ) : null}
        <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <PlayCircle aria-hidden className="size-3.5" />
            {t('lessons', { count: course.lessonCount })}
          </span>
          {course.totalDurationSec > 0 ? (
            <span className="flex items-center gap-1">
              <Clock aria-hidden className="size-3.5" />
              {formatDuration(course.totalDurationSec)}
            </span>
          ) : null}
        </p>
        <div className="mt-auto border-t border-border pt-3">
          <PriceTag price={course.price} locale={locale} freeLabel={t('free')} />
        </div>
      </div>
    </Link>
    {wishlisted !== undefined ? (
      <WishlistButton courseId={course.id} initial={wishlisted} className="absolute right-6 top-6 md:right-7 md:top-7" />
    ) : null}
    </div>
  );
}

export function CourseGrid({ children }: { children: React.ReactNode }) {
  return <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 md:gap-6">{children}</ul>;
}
