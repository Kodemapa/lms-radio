import { type CourseReviewEvent, type CourseReviewKind } from '@obgyn/types';
import { CheckCircle2, CornerUpLeft, MessageSquareWarning, Send } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';

export const REVIEW_KIND_STYLE: Record<
  CourseReviewKind,
  { icon: typeof Send; chip: string; dot: string }
> = {
  SUBMITTED: {
    icon: Send,
    chip: 'bg-primary-light text-primary',
    dot: 'bg-primary text-primary-foreground',
  },
  CHANGES_REQUESTED: {
    icon: MessageSquareWarning,
    chip: 'bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-100',
    dot: 'bg-amber-500 text-white',
  },
  PUBLISHED: {
    icon: CheckCircle2,
    chip: 'bg-green-100 text-green-900 dark:bg-green-900/40 dark:text-green-100',
    dot: 'bg-green-600 text-white',
  },
  WITHDRAWN: {
    icon: CornerUpLeft,
    chip: 'bg-muted text-muted-foreground',
    dot: 'bg-muted-foreground text-background',
  },
};

/** Coloured label for one review step. */
export function ReviewKindChip({ kind }: { kind: CourseReviewKind }) {
  const t = useTranslations('Instructor.reviewHistory');
  const { icon: Icon, chip } = REVIEW_KIND_STYLE[kind];
  return (
    <span
      className={`inline-flex w-fit items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${chip}`}
    >
      <Icon aria-hidden className="size-3.5" />
      {t(`kind.${kind}`)}
    </span>
  );
}

/** Vertical timeline of one course's review steps, newest first. */
export function ReviewHistoryList({ events }: { events: CourseReviewEvent[] }) {
  const t = useTranslations('Instructor.reviewHistory');
  const tx = useTranslations('Instructor.reviewHistoryExtra');
  const format = useFormatter();
  if (events.length === 0) return <p className="text-sm text-muted-foreground">{t('empty')}</p>;
  return (
    <ol className="relative flex flex-col">
      {events.map((event, index) => {
        const { icon: Icon, dot } = REVIEW_KIND_STYLE[event.kind];
        const last = index === events.length - 1;
        return (
          <li key={event.id} className="relative flex gap-4 pb-6 last:pb-0">
            {/* connector line between steps */}
            {!last ? (
              <span
                aria-hidden
                className="absolute start-[15px] top-9 h-[calc(100%-2.25rem)] w-px bg-border"
              />
            ) : null}
            <span
              className={`relative z-10 flex size-8 shrink-0 items-center justify-center rounded-full ${dot}`}
            >
              <Icon aria-hidden className="size-4" />
            </span>
            <div className="flex min-w-0 flex-1 flex-col gap-1.5 pt-0.5">
              <div className="flex flex-wrap items-center gap-2">
                <ReviewKindChip kind={event.kind} />
                {index === 0 ? (
                  <span className="rounded-full border border-border px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    {tx('current')}
                  </span>
                ) : null}
              </div>
              <p className="text-sm text-muted-foreground">
                <time dateTime={event.createdAt}>
                  {format.dateTime(new Date(event.createdAt), {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  })}
                </time>
                {event.actorName ? ` · ${t('by', { name: event.actorName })}` : ''}
              </p>
              {event.kind === 'CHANGES_REQUESTED' ? (
                <blockquote className="mt-1 rounded-xl border-s-4 border-amber-400 bg-amber-50 px-4 py-3 dark:bg-amber-950/30">
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-amber-900 dark:text-amber-200">
                    {tx('note')}
                  </p>
                  <p className="whitespace-pre-line text-sm text-foreground">
                    {event.note || tx('noNote')}
                  </p>
                </blockquote>
              ) : event.note ? (
                <p className="whitespace-pre-line rounded-xl bg-muted px-4 py-3 text-sm">
                  {event.note}
                </p>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
