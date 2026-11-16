import { type PublicInstructor } from '@obgyn/types';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { initials } from '@/lib/initials';

export async function InstructorCard({ instructor }: { instructor: PublicInstructor }) {
  const t = await getTranslations('Common');
  return (
    <Link
      href={`/instructors/${instructor.id}`}
      className="group flex h-full flex-col items-center gap-3 rounded-2xl border border-border bg-card p-6 text-center transition-colors hover:border-primary"
    >
      <span className="flex size-20 items-center justify-center rounded-full bg-primary-light text-2xl font-bold text-primary">
        {initials(instructor.displayName)}
      </span>
      <span className="font-semibold group-hover:text-primary">{instructor.displayName}</span>
      {instructor.headline ? (
        <span className="line-clamp-2 text-sm text-muted-foreground">{instructor.headline}</span>
      ) : null}
      <span className="mt-auto flex gap-3 text-xs text-muted-foreground">
        <span>{t('coursesCount', { count: instructor.courseCount })}</span>
        <span aria-hidden>·</span>
        <span>{t('students', { count: instructor.studentCount })}</span>
      </span>
    </Link>
  );
}
