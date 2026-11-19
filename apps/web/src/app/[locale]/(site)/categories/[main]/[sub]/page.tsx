import { setRequestLocale } from 'next-intl/server';
import { CategoryView, categoryMeta } from '@/components/course/category-view';
import { type CatalogueQuery } from '@/components/course/course-catalogue';

type Props = {
  params: Promise<{ locale: string; main: string; sub: string }>;
  searchParams: Promise<CatalogueQuery>;
};

export async function generateMetadata({ params }: Props) {
  const { main, sub } = await params;
  return (await categoryMeta(main, sub)) ?? {};
}

export default async function SubCategoryPage({ params, searchParams }: Props) {
  const { locale, main, sub } = await params;
  setRequestLocale(locale);
  return <CategoryView locale={locale} mainSlug={main} subSlug={sub} query={await searchParams} />;
}
