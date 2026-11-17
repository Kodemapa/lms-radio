import { ContentPageSchema, parseContentBlocks } from '@obgyn/types';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
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
  const blocks = parseContentBlocks(page.body);

  return (
    <article className="container section-gap max-w-3xl">
      <header className="mb-8">
        <h1 className="section-title">{page.title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {t('updated', { date: new Intl.DateTimeFormat(locale).format(new Date(page.updatedAt)) })}
        </p>
      </header>
      <div className="flex flex-col gap-5 leading-7">
        {blocks.map((block, index) => {
          if (block.kind === 'heading') {
            return block.level === 2 ? (
              <h2 key={index} className="mt-3 text-xl font-semibold">{block.text}</h2>
            ) : (
              <h3 key={index} className="mt-2 text-lg font-semibold">{block.text}</h3>
            );
          }
          if (block.kind === 'list') {
            return (
              <ul key={index} className="list-disc space-y-2 ps-6">
                {block.items.map((item, itemIndex) => <li key={itemIndex}>{item}</li>)}
              </ul>
            );
          }
          return <p key={index} className="whitespace-pre-wrap">{block.text}</p>;
        })}
      </div>
    </article>
  );
}
