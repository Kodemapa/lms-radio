import { Lock } from 'lucide-react';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { LessonView } from '@/components/player/lesson-view';
import { Link } from '@/i18n/navigation';
import { getPlayerLesson } from '@/lib/learning-server';

type Props = { params: Promise<{ locale: string; slug: string; lessonId: string }> };

export default async function LessonPage({ params }: Props) {
  const { locale, slug, lessonId } = await params;
  setRequestLocale(locale);
  const [result, t] = await Promise.all([getPlayerLesson(locale, slug, lessonId), getTranslations('Player')]);

  if (!result.ok) {
    return (
      <div className="mx-auto flex max-w-xl flex-col items-center gap-4 rounded-2xl border border-border bg-card p-10 text-center">
        <Lock aria-hidden className="size-10 text-muted-foreground" />
        <p>{result.code === 'LOCKED_SEQUENCE' ? t('lockedBody') : t('notEnrolled')}</p>
        <Link href={`/courses/${slug}`} className="font-medium text-primary hover:underline">{t('goToCourse')}</Link>
      </div>
    );
  }
  return <LessonView key={result.lesson.id} lesson={result.lesson} />;
}
