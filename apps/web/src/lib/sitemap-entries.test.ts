import { describe, expect, it } from 'vitest';
import { buildSitemap, STATIC_PATHS } from './sitemap-entries';

describe('buildSitemap', () => {
  it('lists static pages, courses and published content pages per language', () => {
    const entries = buildSitemap(
      'https://example.org',
      [{ slug: 'fetal-biometry' }],
      [
        { slug: 'privacy', locale: 'en', updatedAt: '2026-11-01T00:00:00.000Z' },
        { slug: 'privacy', locale: 'hi', updatedAt: '2026-11-05T00:00:00.000Z' },
      ],
      ['en', 'hi'],
    );
    const urls = entries.map((entry) => entry.url);
    expect(urls).toHaveLength((STATIC_PATHS.length + 1 + 1) * 2);
    expect(urls).toContain('https://example.org/en');
    expect(urls).toContain('https://example.org/hi/courses/fetal-biometry');
    expect(urls.filter((url) => url.endsWith('/pages/privacy'))).toEqual([
      'https://example.org/en/pages/privacy',
      'https://example.org/hi/pages/privacy',
    ]);
    const privacy = entries.find((entry) => entry.url === 'https://example.org/en/pages/privacy');
    expect(privacy?.lastModified).toEqual(new Date('2026-11-05T00:00:00.000Z'));
    expect(privacy?.alternates?.languages).toEqual({
      en: 'https://example.org/en/pages/privacy',
      hi: 'https://example.org/hi/pages/privacy',
    });
  });

  it('lists category pages that have published courses', () => {
    const node = (slug: string, courseCount: number, children: { slug: string; courseCount: number }[] = []) => ({
      id: slug,
      slug,
      name: slug,
      description: null,
      courseCount,
      children: children.map((child) => ({ id: child.slug, name: child.slug, description: null, children: [], ...child })),
    });
    const urls = buildSitemap('https://example.org', [], [], ['en'], [
      node('ultrasound', 3, [{ slug: 'doppler', courseCount: 3 }, { slug: 'empty-sub', courseCount: 0 }]),
      node('empty-main', 0),
    ]).map((entry) => entry.url);
    expect(urls).toContain('https://example.org/en/categories/ultrasound');
    expect(urls).toContain('https://example.org/en/categories/ultrasound/doppler');
    expect(urls.some((url) => url.includes('empty'))).toBe(false);
  });

  it('never lists protected areas', () => {
    const urls = buildSitemap('https://example.org', [], [], ['en']).map((entry) => entry.url);
    expect(urls.some((url) => /\/(admin|instructor|learn|account|login)(\/|$)/.test(url))).toBe(false);
  });
});
