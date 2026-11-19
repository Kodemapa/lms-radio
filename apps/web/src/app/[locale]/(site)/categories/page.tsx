import { redirect } from '@/i18n/navigation';

/** There is no category index of its own: the catalogue lists every category. */
export default async function CategoriesIndex({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  redirect({ href: '/courses', locale });
}
