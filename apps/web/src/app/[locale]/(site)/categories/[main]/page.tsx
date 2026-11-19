import { setRequestLocale } from 'next-intl/server';
import { CategoryView, categoryMeta } from '@/components/course/category-view';
import { type CatalogueQuery } from '@/components/course/course-catalogue';

type Props = { params: Promise<{ locale: string; main: string }>; searchParams: Promise<CatalogueQuery> };

export async function generateMetadata({ params }: Props) {
  const { main } = await params;
  return (await categoryMeta(main)) ?? {};
}

export default async function MainCategoryPage({ params, searchParams }: Props) {
  const { locale, main } = await params;
  setRequestLocale(locale);
  return <CategoryView locale={locale} mainSlug={main} query={await searchParams} />;
}
