import { COURSE_LEVELS, COURSE_SORTS, type CategoryNode } from '@obgyn/types';
import { Select } from '@obgyn/ui';
import { ChevronLeft, ChevronRight, SlidersHorizontal } from 'lucide-react';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { AutoSubmitForm } from '@/components/course/auto-submit-form';
import { CourseCard, CourseGrid } from '@/components/course/course-card';
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

function RadioGroup({
  legend,
  name,
  value,
  options,
}: {
  legend: string;
  name: string;
  value: string;
  options: { value: string; label: string; indent?: number }[];
}) {
  return (
    <fieldset className="flex flex-col gap-2 border-b border-border pb-5">
      <legend className="mb-3 font-semibold">{legend}</legend>
      {options.map((option) => (
        <label
          key={option.value}
          className="flex cursor-pointer items-center gap-2.5 text-sm"
          style={{ paddingInlineStart: `${(option.indent ?? 0) * 1}rem` }}
        >
          <input
            type="radio"
            name={name}
            value={option.value}
            defaultChecked={value === option.value}
            className="size-4 accent-[var(--primary)]"
          />
          {option.label}
        </label>
      ))}
    </fieldset>
  );
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
      <section className="bg-section py-8 md:py-12">
        <div className="container flex flex-col gap-2">
          <h1 className="text-3xl font-bold md:text-4xl">
            {query.q ? t('searchResults', { q: query.q }) : t('title')}
          </h1>
          <p className="text-muted-foreground">{t('subtitle')}</p>
        </div>
      </section>

      <div className="container grid gap-8 py-8 lg:grid-cols-[280px_1fr] lg:py-12">
        <aside aria-label={t('filters')}>
          <AutoSubmitForm action={`/${locale}/courses`} className="flex flex-col gap-5 rounded-2xl border border-border bg-card p-5 lg:sticky lg:top-4">
            <p className="flex items-center gap-2 text-lg font-semibold">
              <SlidersHorizontal aria-hidden className="size-5" />
              {t('filters')}
            </p>
            {query.q ? <input type="hidden" name="q" value={query.q} /> : null}
            {query.sort ? <input type="hidden" name="sort" value={query.sort} /> : null}
            <RadioGroup
              legend={t('category')}
              name="category"
              value={query.category ?? ''}
              options={[
                { value: '', label: t('any') },
                ...flatten(categories).map(({ node, depth }) => ({
                  value: node.slug,
                  label: `${node.name} (${node.courseCount})`,
                  indent: depth,
                })),
              ]}
            />
            <RadioGroup
              legend={t('level')}
              name="level"
              value={query.level ?? ''}
              options={[
                { value: '', label: t('any') },
                ...COURSE_LEVELS.map((level) => ({ value: level, label: tCommon(`level.${level}`) })),
              ]}
            />
            <RadioGroup
              legend={t('price')}
              name="price"
              value={query.price ?? ''}
              options={[
                { value: '', label: t('any') },
                { value: 'free', label: t('free') },
                { value: 'paid', label: t('paid') },
              ]}
            />
            <RadioGroup
              legend={t('language')}
              name="language"
              value={query.language ?? ''}
              options={[
                { value: '', label: t('any') },
                ...LANGUAGES.map((code) => ({ value: code, label: tCommon(`languages.${code}`) })),
              ]}
            />
            <noscript>
              <button type="submit" className="w-full rounded-[4px] bg-primary py-2 font-medium text-primary-foreground">
                {t('applyFilters')}
              </button>
            </noscript>
            {hasFilters ? (
              <Link href="/courses" className="text-center text-sm font-medium text-primary hover:underline">
                {t('clearFilters')}
              </Link>
            ) : null}
          </AutoSubmitForm>
        </aside>

        <div className="flex flex-col gap-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p role="status" className="font-medium">
              {result ? t('results', { count: result.total }) : null}
            </p>
            <AutoSubmitForm action={`/${locale}/courses`} className="flex items-center gap-2">
              {Object.entries(query)
                .filter(([key, value]) => value && key !== 'sort' && key !== 'page')
                .map(([key, value]) => (
                  <input key={key} type="hidden" name={key} value={value} />
                ))}
              <label htmlFor="sort" className="whitespace-nowrap text-sm text-muted-foreground">
                {t('sortBy')}
              </label>
              <Select id="sort" name="sort" defaultValue={query.sort ?? 'newest'} className="h-10 w-48">
                {COURSE_SORTS.map((sort) => (
                  <option key={sort} value={sort}>
                    {t(`sort.${sort}`)}
                  </option>
                ))}
              </Select>
            </AutoSubmitForm>
          </div>

          {result === null ? (
            <p role="alert" className="rounded-2xl border border-border p-10 text-center text-muted-foreground">
              {t('unavailable')}
            </p>
          ) : result.items.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border p-10 text-center">
              <p className="text-muted-foreground">{t('empty')}</p>
              {hasFilters ? (
                <Link href="/courses" className="font-medium text-primary hover:underline">
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
                    <Link href={pageHref(page - 1)} aria-label={t('prevPage')} className="rounded-full border border-border p-2 hover:border-primary">
                      <ChevronLeft aria-hidden className="size-5" />
                    </Link>
                  ) : null}
                  <span className="text-sm">{t('page', { page, pages })}</span>
                  {page < pages ? (
                    <Link href={pageHref(page + 1)} aria-label={t('nextPage')} className="rounded-full border border-border p-2 hover:border-primary">
                      <ChevronRight aria-hidden className="size-5" />
                    </Link>
                  ) : null}
                </nav>
              ) : null}
            </>
          )}
        </div>
      </div>
    </>
  );
}
