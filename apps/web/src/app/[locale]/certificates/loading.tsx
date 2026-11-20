import { getTranslations } from 'next-intl/server';
import { GlobalLoader } from '@/components/layout/page-loader';

/** Shown while this page renders on the server, so a click gives instant feedback. */
export default async function Loading() {
  const t = await getTranslations('Common');
  return <GlobalLoader label={t('loading')} />;
}
