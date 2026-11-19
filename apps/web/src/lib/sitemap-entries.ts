import {
  CategoryTreeSchema,
  CourseListResponseSchema,
  PublicPageRefSchema,
  type CategoryNode,
  type PublicPageRef,
} from '@obgyn/types';
import { type MetadataRoute } from 'next';
import { z } from 'zod';
import { routing } from '@/i18n/routing';
import { categoryPath } from './categories';
import { API_URL } from './env';

/** Public, indexable pages that exist in every language. */
export const STATIC_PATHS = ['', '/courses', '/instructors', '/simulators', '/become-instructor', '/faq', '/contact'];
const PAGE_SIZE = 48;
const MAX_COURSE_PAGES = 50;

type Course = { slug: string };

async function getJson<T>(path: string, schema: z.ZodType<T, z.ZodTypeDef, unknown>): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, { headers: { accept: 'application/json' }, next: { revalidate: 3600 } });
  if (!response.ok) throw new Error(`${path} → ${response.status}`);
  return schema.parse(await response.json());
}

async function publishedCourses(): Promise<Course[]> {
  const courses: Course[] = [];
  for (let page = 1; page <= MAX_COURSE_PAGES; page++) {
    const result = await getJson(`/courses?page=${page}&pageSize=${PAGE_SIZE}`, CourseListResponseSchema);
    courses.push(...result.items);
    if (page * result.pageSize >= result.total) break;
  }
  return courses;
}

/** Builds sitemap entries; pure so it can be unit-tested. */
export function buildSitemap(
  baseUrl: string,
  courses: Course[],
  pages: PublicPageRef[],
  locales: readonly string[] = routing.locales,
  categories: CategoryNode[] = [],
): MetadataRoute.Sitemap {
  const alternates = (path: string) => ({
    languages: Object.fromEntries(locales.map((locale) => [locale, `${baseUrl}/${locale}${path}`])),
  });
  const entries: MetadataRoute.Sitemap = [];
  // Category pages that list at least one published course (counts include sub-categories).
  const categoryPaths = categories.flatMap((main) =>
    main.courseCount === 0
      ? []
      : [
          categoryPath(main.slug),
          ...main.children.filter((sub) => sub.courseCount > 0).map((sub) => categoryPath(main.slug, sub.slug)),
        ],
  );
  for (const path of [...STATIC_PATHS, ...categoryPaths, ...courses.map((course) => `/courses/${course.slug}`)]) {
    for (const locale of locales) entries.push({ url: `${baseUrl}/${locale}${path}`, alternates: alternates(path) });
  }
  // A page shows English when its translation is missing, so list it once per site language.
  const bySlug = new Map<string, Date>();
  for (const page of pages) {
    const updated = new Date(page.updatedAt);
    const previous = bySlug.get(page.slug);
    if (!previous || updated > previous) bySlug.set(page.slug, updated);
  }
  for (const [slug, lastModified] of bySlug) {
    const path = `/pages/${slug}`;
    for (const locale of locales) entries.push({ url: `${baseUrl}/${locale}${path}`, lastModified, alternates: alternates(path) });
  }
  return entries;
}

/** If the API is down the sitemap still lists the static pages. */
export async function loadSitemapSources(): Promise<{
  courses: Course[];
  pages: PublicPageRef[];
  categories: CategoryNode[];
}> {
  const [courses, pages, categories] = await Promise.all([
    publishedCourses().catch((error) => {
      console.error('Sitemap: course list unavailable', error);
      return [];
    }),
    getJson('/content/pages', z.array(PublicPageRefSchema)).catch((error) => {
      console.error('Sitemap: page list unavailable', error);
      return [];
    }),
    getJson('/categories', CategoryTreeSchema).catch((error) => {
      console.error('Sitemap: category list unavailable', error);
      return [];
    }),
  ]);
  return { courses, pages, categories };
}
