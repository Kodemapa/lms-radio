'use client';

import { InstructorReviewSchema, REVIEW_REPORT_REASONS, type InstructorReview } from '@obgyn/types';
import { Button, Select, Textarea, toast } from '@obgyn/ui';
import { Flag, Star } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { z } from 'zod';
import { api, ApiClientError } from '@/lib/instructor-api';

type Filter = 'all' | 'unanswered' | 'reported';

/** Reviews of the courses I teach: reply publicly, or report abusive ones to admins. */
export function ReviewsManager() {
  const t = useTranslations('Teaching');
  const [filter, setFilter] = useState<Filter>('all');
  const [items, setItems] = useState<InstructorReview[] | null>(null);
  const [error, setError] = useState(false);
  const [page, setPage] = useState(1);
  const tCommon = useTranslations('Common');
  const tAdmin = useTranslations('Admin');

  const load = () =>
    api('GET', `instructor/reviews?filter=${filter}`)
      .then((d) => setItems(z.array(InstructorReviewSchema).parse(d)))
      .catch(() => setError(true));
  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  return (
    <div className="flex flex-col gap-4">
      <div role="tablist" aria-label={t('filter')} className="flex flex-wrap gap-2">
        {(['all', 'unanswered', 'reported'] as const).map((f) => (
          <button
            key={f}
            type="button"
            role="tab"
            aria-selected={filter === f}
            onClick={() => {
              setFilter(f);
              setPage(1);
            }}
            className={`rounded-full border px-3 py-1 text-sm ${filter === f ? 'border-primary bg-primary-light text-primary' : 'border-border hover:bg-muted'}`}
          >
            {t(`reviewFilter.${f}`)}
          </button>
        ))}
      </div>
      {error ? <p role="alert" className="text-sm text-destructive">{t('loadFailed')}</p> : null}
      {items === null ? (
        !error ? <p role="status" className="text-sm text-muted-foreground">{t('loading')}</p> : null
      ) : items.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-primary/25 bg-primary-light/40 p-8 text-center text-muted-foreground">{t('noReviews')}</p>
      ) : (
        <>
          <ul className="flex flex-col gap-3">
            {items.slice((Math.min(page, Math.ceil(items.length / REVIEWS_PER_PAGE)) - 1) * REVIEWS_PER_PAGE).slice(0, REVIEWS_PER_PAGE).map((r) => (
              <ReviewItem key={`${r.courseId}-${r.userId}`} review={r} onChanged={() => void load()} />
            ))}
          </ul>
          {items.length > REVIEWS_PER_PAGE ? (
            <ClientPager
              page={Math.min(page, Math.ceil(items.length / REVIEWS_PER_PAGE))}
              total={items.length}
              onPage={setPage}
              labels={{ pages: tAdmin('pages'), previous: tCommon('previous'), next: tCommon('next'), range: (start, end) => tAdmin('pageRange', { start, end, total: items.length }) }}
            />
          ) : null}
        </>
      )}
    </div>
  );
}

function ReviewItem({ review, onChanged }: { review: InstructorReview; onChanged: () => void }) {
  const t = useTranslations('Teaching');
  const tCommon = useTranslations('Common');
  const locale = useLocale();
  const [replying, setReplying] = useState(false);
  const [reply, setReply] = useState(review.reply ?? '');
  const [reporting, setReporting] = useState(false);
  const [reason, setReason] = useState<(typeof REVIEW_REPORT_REASONS)[number]>('ABUSE');
  const [error, setError] = useState<string | null>(null);
  const base = `instructor/courses/${review.courseId}/reviews/${review.userId}`;
  const run = async (fn: () => Promise<unknown>) => {
    setError(null);
    try {
      await fn();
      setReplying(false);
      setReporting(false);
      toast.success(tCommon('toast.saved'));
      onChanged();
    } catch (e) {
      setError(e instanceof ApiClientError && e.messageText ? e.messageText : t('actionFailed'));
    }
  };

  return (
    <li className="flex flex-col gap-2 surface-sm p-4 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium">{review.authorName}</span>
        <span className="flex items-center gap-0.5" aria-label={t('stars', { count: review.rating })}>
          {Array.from({ length: 5 }, (_, i) => (
            <Star key={i} aria-hidden className={`size-4 ${i < review.rating ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground'}`} />
          ))}
        </span>
        <span className="text-xs text-muted-foreground">
          {review.courseTitle} · {new Date(review.createdAt).toLocaleDateString(locale, { dateStyle: 'medium' })}
        </span>
        {review.reportedAt ? <span className="rounded bg-accent-light px-1.5 py-0.5 text-xs text-accent-deep">{t('reported', { reason: t(`reportReason.${review.reportReason ?? 'OTHER'}`) })}</span> : null}
        {review.hidden ? <span className="rounded bg-muted px-1.5 py-0.5 text-xs">{t('hiddenByAdmin')}</span> : null}
      </div>
      {review.comment ? <p className="whitespace-pre-line">{review.comment}</p> : null}
      {review.reply && !replying ? (
        <div className="border-s-2 border-primary/40 ps-3">
          <span className="block text-xs font-medium text-primary">{t('yourReply')}</span>
          <p className="whitespace-pre-line">{review.reply}</p>
        </div>
      ) : null}
      {replying ? (
        <div className="flex flex-col gap-2">
          <Textarea rows={3} maxLength={2000} value={reply} aria-label={t('replyLabel')} onChange={(e) => setReply(e.target.value)} />
          <div className="flex flex-wrap gap-2">
            <Button size="sm" disabled={!reply.trim()} onClick={() => void run(() => api('PUT', `${base}/reply`, { reply: reply.trim() }))}>{t('postReply')}</Button>
            {review.reply ? <Button size="sm" variant="outline" onClick={() => void run(() => api('PUT', `${base}/reply`, { reply: null }))}>{t('removeReply')}</Button> : null}
            <Button size="sm" variant="ghost" onClick={() => setReplying(false)}>{t('cancel')}</Button>
          </div>
        </div>
      ) : reporting ? (
        <div className="flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-1 text-xs">
            {t('reportReasonLabel')}
            <Select value={reason} onChange={(e) => setReason(e.target.value as typeof reason)}>
              {REVIEW_REPORT_REASONS.map((r) => (
                <option key={r} value={r}>{t(`reportReason.${r}`)}</option>
              ))}
            </Select>
          </label>
          <Button size="sm" onClick={() => void run(() => api('POST', `${base}/report`, { reason }))}>{t('sendReport')}</Button>
          <Button size="sm" variant="ghost" onClick={() => setReporting(false)}>{t('cancel')}</Button>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => setReplying(true)}>{review.reply ? t('editReply') : t('reply')}</Button>
          {!review.reportedAt ? (
            <Button size="sm" variant="ghost" onClick={() => setReporting(true)}>
              <Flag aria-hidden className="size-4" />
              {t('report')}
            </Button>
          ) : null}
        </div>
      )}
      {error ? <p role="alert" className="text-destructive">{error}</p> : null}
    </li>
  );
}

const REVIEWS_PER_PAGE = 10;

/** Previous / Next for a list already loaded in the browser. */
function ClientPager({
  page,
  total,
  onPage,
  labels,
}: {
  page: number;
  total: number;
  onPage: (page: number) => void;
  labels: { pages: string; previous: string; next: string; range: (start: number, end: number) => string };
}) {
  const pages = Math.max(1, Math.ceil(total / REVIEWS_PER_PAGE));
  const start = (page - 1) * REVIEWS_PER_PAGE + 1;
  const end = Math.min(page * REVIEWS_PER_PAGE, total);
  const button =
    'inline-flex h-10 items-center rounded-full border border-border bg-card px-4 text-sm font-medium hover:bg-primary-light hover:text-primary disabled:pointer-events-none disabled:opacity-40';
  return (
    <nav aria-label={labels.pages} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card px-4 py-3">
      <span className="text-sm text-muted-foreground">{labels.range(start, end)}</span>
      <div className="flex items-center gap-2">
        <button type="button" className={button} disabled={page <= 1} onClick={() => onPage(page - 1)}>
          {labels.previous}
        </button>
        <span className="min-w-16 text-center text-sm tabular-nums" aria-current="page">
          {page} / {pages}
        </span>
        <button type="button" className={button} disabled={page >= pages} onClick={() => onPage(page + 1)}>
          {labels.next}
        </button>
      </div>
    </nav>
  );
}
