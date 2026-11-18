import { type CourseReviewEvent, type CourseReviewKind } from '@obgyn/types';
import { CheckCircle2, CornerUpLeft, MessageSquareWarning, Send } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import { type ReactNode } from 'react';

const ICON: Record<CourseReviewKind, { icon: typeof Send; tone: string }> = {
  SUBMITTED: { icon: Send, tone: 'bg-primary-light text-primary' },
  CHANGES_REQUESTED: { icon: MessageSquareWarning, tone: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200' },
  PUBLISHED: { icon: CheckCircle2, tone: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200' },
  WITHDRAWN: { icon: CornerUpLeft, tone: 'bg-muted text-muted-foreground' },
};

/**
 * Timeline of a course's review steps (or of all courses, for admins: pass
 * `courseOf` to show which course each step belongs to). Newest first.
 */
export function ReviewHistoryList<T extends CourseReviewEvent>({
  events,
  courseOf,
}: {
  events: T[];
  courseOf?: (event: T) => ReactNode;
}) {
  const t = useTranslations('Instructor.reviewHistory');
  const format = useFormatter();
  if (events.length === 0) return <p className="text-sm text-muted-foreground">{t('empty')}</p>;
  return (
    <ol className="flex flex-col gap-3">
      {events.map((event) => {
        const { icon: Icon, tone } = ICON[event.kind];
        return (
          <li key={event.id} className="flex gap-3">
            <span className={`mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full ${tone}`}>
              <Icon aria-hidden className="size-4" />
            </span>
            <div className="flex min-w-0 flex-col gap-0.5">
              <p className="text-sm">
                <span className="font-medium">{t(`kind.${event.kind}`)}</span>
                {courseOf ? <> · {courseOf(event)}</> : null}
              </p>
              <p className="text-xs text-muted-foreground">
                {format.dateTime(new Date(event.createdAt), { dateStyle: 'medium', timeStyle: 'short' })}
                {event.actorName ? ` · ${t('by', { name: event.actorName })}` : ''}
              </p>
              {event.note ? <p className="mt-1 whitespace-pre-line rounded-lg bg-muted px-3 py-2 text-sm">{event.note}</p> : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
