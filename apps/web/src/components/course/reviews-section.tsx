import { type ReviewList } from '@obgyn/types';
import { getFormatter, getTranslations } from 'next-intl/server';
import { RatingStars } from './rating-stars';
import { ReviewForm } from './review-form';

export async function ReviewsSection({
  slug,
  reviews,
  canReview,
}: {
  slug: string;
  reviews: ReviewList;
  canReview: boolean;
}) {
  const [t, format] = await Promise.all([getTranslations('Reviews'), getFormatter()]);
  const mine = reviews.items.find((r) => r.mine) ?? null;
  const max = Math.max(1, ...reviews.distribution);

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-6 rounded-2xl border border-border p-5 sm:grid-cols-[auto_1fr] sm:items-center">
        <div className="flex flex-col items-center gap-1 sm:px-6">
          <span className="text-5xl font-bold">{reviews.average?.toFixed(1) ?? '–'}</span>
          <RatingStars value={reviews.average ?? 0} />
          <span className="text-sm text-muted-foreground">{t('count', { count: reviews.count })}</span>
        </div>
        <ul className="flex flex-col gap-1.5" aria-label={t('title')}>
          {[5, 4, 3, 2, 1].map((star) => {
            const count = reviews.distribution[star - 1] ?? 0;
            return (
              <li key={star} className="flex items-center gap-3 text-sm">
                <span className="w-14 shrink-0">{t('star', { count: star })}</span>
                <span className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                  <span className="block h-full bg-rating" style={{ width: `${(count / max) * 100}%` }} />
                </span>
                <span className="w-8 shrink-0 text-right text-muted-foreground">{count}</span>
              </li>
            );
          })}
        </ul>
      </div>

      {canReview ? <ReviewForm slug={slug} initial={mine ? { rating: mine.rating, comment: mine.comment } : null} /> : null}

      {reviews.items.length === 0 ? (
        <p className="text-muted-foreground">{t('none')}</p>
      ) : (
        <ul className="flex flex-col divide-y divide-border">
          {reviews.items.map((review, index) => (
            <li key={`${review.authorName}-${index}`} className="flex flex-col gap-1.5 py-4">
              <div className="flex flex-wrap items-center gap-3">
                <span className="font-medium">{review.mine ? t('you') : review.authorName}</span>
                <RatingStars value={review.rating} />
                <span className="text-xs text-muted-foreground">
                  {format.dateTime(new Date(review.updatedAt), { dateStyle: 'medium' })}
                </span>
              </div>
              <span className="sr-only">{t('star', { count: review.rating })}</span>
              {review.comment ? <p className="whitespace-pre-line text-muted-foreground">{review.comment}</p> : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
