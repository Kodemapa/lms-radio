import { COURSE_LEVELS, COURSE_SORTS, type CategoryNode } from '@obgyn/types';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { CourseCard, CourseGrid } from '@/components/course/course-card';
import { CourseFilterBar } from '@/components/course/course-filter-bar';
import { PageHero } from '@/components/layout/page-hero';
import { Link } from '@/i18n/navigation';
import { getCategories, getCourses, getWishlistIds } from '@/lib/catalog';

type SearchParams = {
  category?: string;
  level?: string;
  price?: string;
  language?: string;
  q?: string;
  sort?: string;
  page?: string;
};
type Props = { params: Promise<{ locale: string }>; searchParams: Promise<SearchParams> };

const PAGE_SIZE = 12;
const LANGUAGES = ['en', 'hi'] as const;

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Courses' });
  return { title: t('title') };
}

function flatten(categories: CategoryNode[], depth = 0): { node: CategoryNode; depth: number }[] {
  return categories.flatMap((node) => [{ node, depth }, ...flatten(node.children, depth + 1)]);
}

export default async function CoursesPage({ params, searchParams }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const query = await searchParams;
  const page = Math.max(1, Number(query.page) || 1);
  const [t, tCommon, categories, result, wishlist] = await Promise.all([
    getTranslations('Courses'),
    getTranslations('Common'),
    getCategories(),
    getCourses({ ...query, page, pageSize: PAGE_SIZE }),
    getWishlistIds(),
  ]);
  const pages = result ? Math.max(1, Math.ceil(result.total / PAGE_SIZE)) : 1;
  const hasFilters = !!(query.category || query.level || query.price || query.language || query.q);

  const pageHref = (target: number) => {
    const next = new URLSearchParams(
      Object.entries(query).filter((entry): entry is [string, string] => !!entry[1]),
    );
    next.set('page', String(target));
    return `/courses?${next}`;
  };

  return (
    <>
      <PageHero
        kicker={t('kicker')}
        title={query.q ? t('searchResults', { q: query.q }) : t('title')}
        subtitle={t('subtitle')}
        className="!pb-8"
      />

      <div className="container flex flex-col gap-8 pb-16 lg:pb-24">
        {/* Search + filters in one bar: the grid gets the full width. */}
        <CourseFilterBar
          action={`/${locale}/courses`}
          query={query.q}
          searchLabel={tCommon('searchLabel')}
          placeholder={tCommon('searchPlaceholder')}
          submitLabel={tCommon('search')}
          filters={[
            {
              name: 'category',
              label: t('category'),
              value: query.category ?? '',
              options: flatten(categories).map(({ node, depth }) => ({
                value: node.slug,
                label: `${'— '.repeat(depth)}${node.name} (${node.courseCount})`,
              })),
            },
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
            {
              name: 'language',
              label: t('language'),
              value: query.language ?? '',
              options: LANGUAGES.map((code) => ({ value: code, label: tCommon(`languages.${code}`) })),
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
              href="/courses"
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
              <Link href="/courses" className="font-semibold text-primary hover:underline">
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
      </div>
    </>
  );
}
