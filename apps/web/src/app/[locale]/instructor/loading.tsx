import { getTranslations } from 'next-intl/server';
import { GlobalLoader } from '@/components/layout/page-loader';

/**
 * Shown while an instructor page renders on the server: the site's global loader,
 * centred on screen, so a sidebar click gives instant feedback.
 */
export default async function InstructorLoading() {
  const t = await getTranslations('Common');
  return <GlobalLoader label={t('loading')} />;
}
