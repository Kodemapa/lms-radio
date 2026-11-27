import { COURSE_LEVELS, COURSE_SORTS, type CategoryNode } from '@obgyn/types';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { CourseCard, CourseGrid } from '@/components/course/course-card';
import { CourseFilterBar } from '@/components/course/course-filter-bar';
import { Link } from '@/i18n/navigation';
import { getCourses, getWishlistIds } from '@/lib/catalog';

export type CatalogueQuery = {
  category?: string;
  level?: string;
  price?: string;
  language?: string;
  q?: string;
  sort?: string;
  page?: string;
};

const PAGE_SIZE = 12;

function flatten(categories: CategoryNode[], depth = 0): { node: CategoryNode; depth: number }[] {
  return categories.flatMap((node) => [{ node, depth }, ...flatten(node.children, depth + 1)]);
}

/**
 * Search + filter bar, result count, course grid and pager. Used by `/courses`
 * (category is a filter) and by the category pages (category fixed by the URL,
 * so the category filter is hidden and links stay on the category page).
 */
export async function CourseCatalogue({
  locale,
  query,
  basePath,
  categories,
  fixedCategory,
  trace = false,
}: {
  locale: string;
  query: CatalogueQuery;
  /** Path (without locale) the form, pager and "clear filters" point at. */
  basePath: string;
  categories: CategoryNode[];
  /** Category slug set by the page; its sub-categories are included by the API. */
  fixedCategory?: string;
  /** Continue the request trace for dynamic category/search renders. */
  trace?: boolean;
}) {
  const page = Math.max(1, Number(query.page) || 1);
  const category = fixedCategory ?? query.category;
  const [t, tCommon, result, wishlist] = await Promise.all([
    getTranslations('Courses'),
    getTranslations('Common'),
    // No language filter any more (English only): an old ?language= link is ignored.
    getCourses({ ...query, language: undefined, category, page, pageSize: PAGE_SIZE }, trace),
    getWishlistIds(),
  ]);
  const pages = result ? Math.max(1, Math.ceil(result.total / PAGE_SIZE)) : 1;
  const hasFilters = !!((fixedCategory ? null : query.category) || query.level || query.price || query.q);

  const pageHref = (target: number) => {
    const next = new URLSearchParams(
      Object.entries(query).filter(
        (entry): entry is [string, string] =>
          !!entry[1] && entry[0] !== 'language' && !(fixedCategory && entry[0] === 'category'),
      ),
    );
    next.set('page', String(target));
    return `${basePath}?${next}`;
  };

  return (
    <>
      {/* Search + filters in one bar: the grid gets the full width. */}
      <CourseFilterBar
        action={`/${locale}${basePath}`}
        query={query.q}
        searchLabel={tCommon('searchLabel')}
        placeholder={tCommon('searchPlaceholder')}
        filters={[
          ...(fixedCategory
            ? []
            : [
                {
                  name: 'category',
                  label: t('category'),
                  value: query.category ?? '',
                  options: flatten(categories).map(({ node, depth }) => ({
                    value: node.slug,
                    label: `${'— '.repeat(depth)}${node.name} (${node.courseCount})`,
                  })),
                },
              ]),
          {
            name: 'level',
            label: t('level'),
            value: query.level ?? '',
            options: COURSE_LEVELS.map((level) => ({ value: level, label: tCommon(`level.${level}`) })),
          },
          {
            name: 'price',
            label: t('price'),
            value: query.price ?? '',
            options: [
              { value: 'free', label: t('free') },
              { value: 'paid', label: t('paid') },
            ],
          },
        ]}
        sort={{
          name: 'sort',
          label: t('sortBy'),
          value: query.sort ?? 'newest',
          options: COURSE_SORTS.map((sort) => ({ value: sort, label: t(`sort.${sort}`) })),
        }}
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p role="status" className="font-semibold">
          {result ? t('results', { count: result.total }) : null}
        </p>
        {hasFilters ? (
          <Link
            href={basePath}
            className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold text-primary transition-colors hover:bg-primary-light"
          >
            <X aria-hidden className="size-4" />
            {t('clearFilters')}
          </Link>
        ) : null}
      </div>

      {result === null ? (
        <p role="alert" className="surface p-10 text-center text-muted-foreground">
          {t('unavailable')}
        </p>
      ) : result.items.length === 0 ? (
        <div className="soft-wash flex flex-col items-center gap-3 rounded-3xl p-12 text-center">
          <p className="text-muted-foreground">{t('empty')}</p>
          {hasFilters ? (
            <Link href={basePath} className="font-semibold text-primary hover:underline">
              {t('clearFilters')}
            </Link>
          ) : null}
        </div>
      ) : (
        <>
          <CourseGrid>
            {result.items.map((course) => (
              <li key={course.id}>
                <CourseCard course={course} wishlisted={wishlist ? wishlist.has(course.id) : undefined} />
              </li>
            ))}
          </CourseGrid>
          {pages > 1 ? (
            <nav aria-label={t('page', { page, pages })} className="flex items-center justify-center gap-4">
              {page > 1 ? (
                <Link
                  href={pageHref(page - 1)}
                  aria-label={t('prevPage')}
                  className="grid size-11 place-items-center rounded-full border border-border bg-card shadow-sm transition-colors hover:border-primary/40 hover:text-primary"
                >
                  <ChevronLeft aria-hidden className="size-5 rtl:rotate-180" />
                </Link>
              ) : null}
              <span className="rounded-full bg-muted px-4 py-2 text-sm font-semibold">{t('page', { page, pages })}</span>
              {page < pages ? (
                <Link
                  href={pageHref(page + 1)}
                  aria-label={t('nextPage')}
                  className="grid size-11 place-items-center rounded-full border border-border bg-card shadow-sm transition-colors hover:border-primary/40 hover:text-primary"
                >
                  <ChevronRight aria-hidden className="size-5 rtl:rotate-180" />
                </Link>
              ) : null}
            </nav>
          ) : null}
        </>
      )}
    </>
  );
}
