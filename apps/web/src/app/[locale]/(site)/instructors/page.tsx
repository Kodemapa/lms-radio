import { getTranslations, setRequestLocale } from 'next-intl/server';
import { InstructorCard } from '@/components/instructor-card';
import { PageHero } from '@/components/layout/page-hero';
import { getInstructors } from '@/lib/catalog';

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Instructors' });
  return { title: t('title') };
}

export default async function InstructorsPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const [t, instructors] = await Promise.all([getTranslations('Instructors'), getInstructors()]);
  return (
    <>
      <PageHero kicker={t('kicker')} title={t('title')} subtitle={t('subtitle')} />
      <div className="container pb-16 pt-2 lg:pb-24">
        {instructors.length === 0 ? (
          <p className="soft-wash rounded-3xl p-12 text-center text-muted-foreground">{t('empty')}</p>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 md:gap-6">
            {instructors.map((instructor) => (
              <li key={instructor.id}>
                <InstructorCard instructor={instructor} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
