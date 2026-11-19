import { type MetadataRoute } from 'next';
import { getPublicSiteSettings, SITE_URL } from '@/lib/site-settings';
import { buildSitemap, loadSitemapSources } from '@/lib/sitemap-entries';

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const settings = await getPublicSiteSettings();
  if (!settings.allowIndexing) return [];
  const { courses, pages, categories } = await loadSitemapSources();
  return buildSitemap(SITE_URL, courses, pages, undefined, categories);
}
