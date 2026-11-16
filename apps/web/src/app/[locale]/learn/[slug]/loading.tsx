import { Skeleton } from '@obgyn/ui';
import { getTranslations } from 'next-intl/server';

/**
 * Shown inside the player shell while a lesson renders on the server, so a
 * click in the curriculum gives instant feedback.
 */
export default async function LessonLoading() {
  const t = await getTranslations('Common');
  return (
    <div role="status" aria-busy="true" className="flex flex-col gap-5">
      <span className="sr-only">{t('loading')}</span>
      <Skeleton className="h-8 w-2/3 max-w-xl" />
      <Skeleton className="aspect-video w-full rounded-2xl" />
      <Skeleton className="h-5 w-full max-w-2xl" />
      <Skeleton className="h-5 w-1/2" />
    </div>
  );
}
