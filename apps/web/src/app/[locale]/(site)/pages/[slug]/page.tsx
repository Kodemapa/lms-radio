import { ContentPageSchema } from '@obgyn/types';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { ContentBlocks } from '@/components/content/content-blocks';
import { ApiError, apiGet } from '@/lib/server-api';

export default async function ContentPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) notFound();

  let page;
  try {
    page = await apiGet(`/content/pages/${encodeURIComponent(slug)}?locale=${encodeURIComponent(locale)}`, ContentPageSchema);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }
  const t = await getTranslations('PublicContent');

  return (
    <article className="container section-gap max-w-3xl">
      <header className="mb-8">
        <h1 className="section-title">{page.title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {t('updated', { date: new Intl.DateTimeFormat(locale).format(new Date(page.updatedAt)) })}
        </p>
      </header>
      <ContentBlocks body={page.body} />
    </article>
  );
}
