import { getTranslations, setRequestLocale } from 'next-intl/server';
import { CourseCatalogue, type CatalogueQuery } from '@/components/course/course-catalogue';
import { PageHero } from '@/components/layout/page-hero';
import { getCategories } from '@/lib/catalog';

type Props = { params: Promise<{ locale: string }>; searchParams: Promise<CatalogueQuery> };

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Courses' });
  return { title: t('title') };
}

export default async function CoursesPage({ params, searchParams }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const query = await searchParams;
  const [t, categories] = await Promise.all([getTranslations('Courses'), getCategories()]);

  return (
    <>
      <PageHero
        kicker={t('kicker')}
        title={query.q ? t('searchResults', { q: query.q }) : t('title')}
        subtitle={t('subtitle')}
        className="!pb-8"
      />

      <div className="container flex flex-col gap-8 pb-16 lg:pb-24">
        <CourseCatalogue locale={locale} query={query} basePath="/courses" categories={categories} />
      </div>
    </>
  );
}
