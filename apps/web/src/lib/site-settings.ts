import { SiteSettingsSchema, type SiteSettings } from '@obgyn/types';
import { API_URL } from './env';

/** Public base URL of this site, used for sitemap/robots/Open Graph links. */
export const SITE_URL = (process.env.NEXT_PUBLIC_WEB_URL ?? 'http://localhost:3000').replace(/\/$/, '');

/**
 * Public settings, cached briefly so footer/metadata rendering does not add a per-page
 * database round trip. If the API is unreachable the defaults are used, so a settings
 * outage never takes the whole site down.
 */
export async function getPublicSiteSettings(): Promise<SiteSettings> {
  try {
    const response = await fetch(`${API_URL}/content/settings`, {
      headers: { accept: 'application/json' },
      next: { revalidate: 60 },
    });
    if (!response.ok) throw new Error(`status ${response.status}`);
    return SiteSettingsSchema.parse(await response.json());
  } catch (error) {
    console.error('Public site settings unavailable; using defaults', error);
    return SiteSettingsSchema.parse({});
  }
}
