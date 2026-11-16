import { getTranslations, setRequestLocale } from 'next-intl/server';
import { ReviewsManager } from '@/components/instructor/teaching/reviews-manager';
import { requireInstructor } from '@/lib/instructor-server';

export default async function InstructorReviewsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireInstructor(locale, '/instructor/reviews');
  const t = await getTranslations('Teaching');
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold md:text-3xl">{t('reviewsTitle')}</h1>
        <p className="text-muted-foreground">{t('reviewsSubtitle')}</p>
      </div>
      <ReviewsManager />
    </div>
  );
}
