import { getTranslations } from 'next-intl/server';
import { GlobalLoader } from '@/components/layout/page-loader';

/**
 * The one route-level loading screen: the cube loader, centred, while a page renders on
 * the server. It covers a first page load and moves between sections of the site
 * (public site ↔ account ↔ admin ↔ instructor ↔ learning player).
 *
 * Why only here, not in every section (there used to be six loading.tsx files): React keeps
 * a Suspense fallback on screen for at least 300 ms once it has been shown, to avoid
 * flicker. A loading.tsx inside each section mounted a fresh fallback on almost every
 * click, so a page the server rendered in ~40 ms still took ~390 ms to appear. With the
 * boundary here, moving within a section keeps the current page until the next one is
 * ready (~100 ms); if that takes longer than 200 ms the navigation loader shows the same
 * cube animation (components/layout/navigation-progress.tsx).
 *
 * The full-height placeholder keeps the footer below the fold behind the overlay.
 */
export default async function Loading() {
  const t = await getTranslations('Common');
  return (
    <div className="min-h-[100dvh]">
      <GlobalLoader label={t('loading')} />
    </div>
  );
}
