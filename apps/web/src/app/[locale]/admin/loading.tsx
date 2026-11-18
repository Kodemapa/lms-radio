import { getTranslations } from 'next-intl/server';
import { GlobalLoader } from '@/components/layout/page-loader';

/**
 * Shown while an admin page renders on the server: the site's global loader, centred on
 * screen. Next.js does not pass `params` to loading files, so the locale comes from
 * next-intl's request locale.
 */
export default async function AdminLoading() {
  const t = await getTranslations('Common');
  return <GlobalLoader label={t('loading')} />;
}
