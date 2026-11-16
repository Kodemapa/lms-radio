import { type CourseStatus } from '@obgyn/types';

const STYLES: Record<CourseStatus, string> = {
  DRAFT: 'bg-muted text-muted-foreground',
  IN_REVIEW: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200',
  PUBLISHED: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200',
  RETIRED: 'bg-muted text-muted-foreground line-through',
};

export function StatusBadge({ status, label }: { status: CourseStatus; label: string }) {
  return (
    <span className={`inline-flex w-fit rounded-full px-2.5 py-0.5 text-xs font-medium ${STYLES[status]}`}>
      {label}
    </span>
  );
}
