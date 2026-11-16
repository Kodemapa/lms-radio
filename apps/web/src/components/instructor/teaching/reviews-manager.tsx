'use client';

import { InstructorReviewSchema, REVIEW_REPORT_REASONS, type InstructorReview } from '@obgyn/types';
import { Button, Select, Textarea } from '@obgyn/ui';
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
            onClick={() => setFilter(f)}
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
        <p className="rounded-xl border border-dashed border-border p-8 text-center text-muted-foreground">{t('noReviews')}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {items.map((r) => (
            <ReviewItem key={`${r.courseId}-${r.userId}`} review={r} onChanged={() => void load()} />
          ))}
        </ul>
      )}
    </div>
  );
}

function ReviewItem({ review, onChanged }: { review: InstructorReview; onChanged: () => void }) {
  const t = useTranslations('Teaching');
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
      onChanged();
    } catch (e) {
      setError(e instanceof ApiClientError && e.messageText ? e.messageText : t('actionFailed'));
    }
  };

  return (
    <li className="flex flex-col gap-2 rounded-xl border border-border bg-card p-4 text-sm">
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
        {review.reportedAt ? <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-900">{t('reported', { reason: t(`reportReason.${review.reportReason ?? 'OTHER'}`) })}</span> : null}
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
