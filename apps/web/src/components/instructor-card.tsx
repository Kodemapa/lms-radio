import { type PublicInstructor } from '@obgyn/types';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { initials } from '@/lib/initials';

export async function InstructorCard({ instructor }: { instructor: PublicInstructor }) {
  const t = await getTranslations('Common');
  return (
    <Link
      href={`/instructors/${instructor.id}`}
      className="surface lift group relative flex h-full flex-col items-center gap-3 overflow-hidden p-6 pt-8 text-center"
    >
      {/* Soft wash behind the avatar ties the card to the landing page. */}
      <span aria-hidden className="soft-wash absolute inset-x-0 top-0 h-20" />
      <span className="relative flex size-20 items-center justify-center rounded-full border-4 border-card bg-gradient-to-br from-[#c9b5ef] to-[#fbc9a1] font-[family-name:var(--display-stack)] text-2xl font-bold text-[#2f2340] shadow-sm">
        {initials(instructor.displayName)}
      </span>
      <span className="text-lg font-semibold tracking-tight group-hover:text-primary">{instructor.displayName}</span>
      {instructor.headline ? (
        <span className="line-clamp-2 text-sm text-muted-foreground">{instructor.headline}</span>
      ) : null}
      <span className="mt-auto flex gap-3 rounded-full bg-muted px-3 py-1.5 text-xs font-medium text-muted-foreground">
        <span>{t('coursesCount', { count: instructor.courseCount })}</span>
        <span aria-hidden>·</span>
        <span>{t('students', { count: instructor.studentCount })}</span>
      </span>
    </Link>
  );
}
