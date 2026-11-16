import { EntranceStatusSchema } from '@obgyn/types';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { EntranceRunner } from '@/components/entrance/entrance-runner';
import { getOutline } from '@/lib/learning-server';
import { apiGet } from '@/lib/server-api';

/** The entrance test is the first "lesson" of the course, inside the player. */
export default async function PlayerEntrancePage({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const outline = await getOutline(locale, slug);
  if (!outline.entrance) notFound();
  const [t, status] = await Promise.all([
    getTranslations('Entrance'),
    apiGet(`/courses/${encodeURIComponent(slug)}/entrance`, EntranceStatusSchema, { auth: true }),
  ]);
  return (
    <article className="mx-auto flex max-w-3xl flex-col gap-5">
      <div>
        <h1 className="text-2xl font-bold">{t('title')}</h1>
        <p className="mt-1 text-muted-foreground">{outline.entrance.passed ? t('alreadyPassed') : t('intro')}</p>
      </div>
      <EntranceRunner
        slug={slug}
        initial={{ ...status, passed: status.passed || outline.entrance.passed }}
        // Never rendered in a production build; the API also refuses it there.
        devSkip={process.env.NODE_ENV !== 'production'}
      />
    </article>
  );
}
