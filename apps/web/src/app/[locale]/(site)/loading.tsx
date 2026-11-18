import { getTranslations } from 'next-intl/server';
import { GlobalLoader } from '@/components/layout/page-loader';

/** Public pages: the site's global loader, centred on screen, while the page loads. */
export default async function SiteLoading() {
  const t = await getTranslations('Common');
  return <GlobalLoader label={t('loading')} />;
}
