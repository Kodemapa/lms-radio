import { type AdminReviewHistory } from '@obgyn/types';
import { useFormatter, useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { ReviewKindChip } from '../instructor/review-history';

/** Admin: review steps across courses as a table (cards on small screens). */
export function ReviewActivityTable({ items }: { items: AdminReviewHistory['items'] }) {
  const t = useTranslations('Instructor.reviewTable');
  const tx = useTranslations('Instructor.reviewHistoryExtra');
  const tHist = useTranslations('Instructor.reviewHistory');
  const format = useFormatter();
  if (items.length === 0)
    return <p className="p-6 text-sm text-muted-foreground">{tHist('empty')}</p>;
  const when = (iso: string) =>
    format.dateTime(new Date(iso), { dateStyle: 'medium', timeStyle: 'short' });
  const note = (item: AdminReviewHistory['items'][number]) =>
    item.kind === 'CHANGES_REQUESTED'
      ? item.note || <span className="italic text-muted-foreground">{tx('noNote')}</span>
      : item.note || '—';
  const course = (item: AdminReviewHistory['items'][number]) => (
    <div className="flex min-w-0 flex-col">
      <Link
        href={`/instructor/courses/${item.course.id}/review`}
        aria-label={t('open', { title: item.course.title })}
        className="font-semibold text-foreground hover:text-primary hover:underline"
      >
        {item.course.title}
      </Link>
      {item.instructorName ? (
        <span className="text-xs text-muted-foreground">
          {t('instructor', { name: item.instructorName })}
        </span>
      ) : null}
    </div>
  );
  return (
    <>
      <table className="hidden w-full text-left text-sm md:table">
        <thead className="border-b border-border bg-muted/60 text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <th scope="col" className="px-4 py-3 font-medium">
              {t('when')}
            </th>
            <th scope="col" className="px-4 py-3 font-medium">
              {t('course')}
            </th>
            <th scope="col" className="px-4 py-3 font-medium">
              {t('action')}
            </th>
            <th scope="col" className="px-4 py-3 font-medium">
              {t('by')}
            </th>
            <th scope="col" className="w-[34%] px-4 py-3 font-medium">
              {t('note')}
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {items.map((item) => (
            <tr key={item.id} className="align-top">
              <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                {when(item.createdAt)}
              </td>
              <td className="px-4 py-3">{course(item)}</td>
              <td className="px-4 py-3">
                <ReviewKindChip kind={item.kind} />
              </td>
              <td className="px-4 py-3">{item.actorName ?? '—'}</td>
              <td className="whitespace-pre-line px-4 py-3">{note(item)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <ul className="divide-y divide-border md:hidden">
        {items.map((item) => (
          <li key={item.id} className="flex flex-col gap-2 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <ReviewKindChip kind={item.kind} />
              <span className="text-xs text-muted-foreground">{when(item.createdAt)}</span>
            </div>
            {course(item)}
            {item.actorName ? (
              <p className="text-xs text-muted-foreground">
                {tHist('by', { name: item.actorName })}
              </p>
            ) : null}
            {item.note || item.kind === 'CHANGES_REQUESTED' ? (
              <p className="whitespace-pre-line rounded-lg bg-muted px-3 py-2 text-sm">
                {note(item)}
              </p>
            ) : null}
          </li>
        ))}
      </ul>
    </>
  );
}
