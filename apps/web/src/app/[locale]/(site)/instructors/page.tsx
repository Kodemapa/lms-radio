import { getTranslations, setRequestLocale } from 'next-intl/server';
import { InstructorCard } from '@/components/instructor-card';
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
      <section className="bg-section py-8 md:py-12">
        <div className="container flex flex-col gap-2">
          <h1 className="text-3xl font-bold md:text-4xl">{t('title')}</h1>
          <p className="text-muted-foreground">{t('subtitle')}</p>
        </div>
      </section>
      <div className="container py-8 lg:py-12">
        {instructors.length === 0 ? (
          <p className="text-muted-foreground">{t('empty')}</p>
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
