import { redirect } from 'next/navigation';

/** The entrance test now lives inside the course player, as the first lesson. */
export default async function EntranceRedirect({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { locale, slug } = await params;
  redirect(`/${locale}/learn/${slug}/entrance`);
}
