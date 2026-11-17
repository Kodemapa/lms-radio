import { type MetadataRoute } from 'next';
import { getPublicSiteSettings, SITE_URL } from '@/lib/site-settings';

export const revalidate = 300;

/** Admins can switch search indexing off in Site settings (e.g. on staging). */
export default async function robots(): Promise<MetadataRoute.Robots> {
  const settings = await getPublicSiteSettings();
  if (!settings.allowIndexing) return { rules: { userAgent: '*', disallow: '/' } };
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      // Signed-in, protected and API areas are never useful in search results.
      // "/*/instructor" alone would be a prefix match and hide the public /instructors pages.
      disallow: ['/api/', '/*/admin', '/*/instructor$', '/*/instructor/', '/*/learn', '/*/account', '/*/login'],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
