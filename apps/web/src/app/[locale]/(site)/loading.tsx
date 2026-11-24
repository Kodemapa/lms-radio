import { getTranslations } from 'next-intl/server';
import { GlobalLoader } from '@/components/layout/page-loader';

/**
 * Public pages: the site's global loader, centred on screen, while the page loads.
 * The loader is an overlay, so a full-height placeholder keeps the footer below the
 * fold; otherwise the empty page pulls it up and it shows through (e.g. after sign-out).
 */
export default async function SiteLoading() {
  const t = await getTranslations('Common');
  return (
    <div className="min-h-[100dvh]">
      <GlobalLoader label={t('loading')} />
    </div>
  );
}
