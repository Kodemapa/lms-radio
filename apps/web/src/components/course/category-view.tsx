import { type CategoryNode } from '@obgyn/types';
import { ChevronRight } from 'lucide-react';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { PageHero } from '@/components/layout/page-hero';
import { Link, redirect } from '@/i18n/navigation';
import { getCategories } from '@/lib/catalog';
import { categoryPath, findCategory } from '@/lib/categories';
import { CourseCatalogue, type CatalogueQuery } from './course-catalogue';

/** Looks the category up for metadata; null when it doesn't exist (or isn't at this URL). */
export async function categoryMeta(mainSlug: string, subSlug?: string) {
  const match = findCategory(await getCategories(true), mainSlug, subSlug);
  if (match.kind !== 'found') return null;
  const shown = match.sub ?? match.main;
  return { title: shown.name, description: shown.description ?? undefined };
}

/**
 * Learner landing page for a main category (`/categories/<main>`) or a
 * sub-category (`/categories/<main>/<sub>`): breadcrumb, description,
 * sub-category chips and the course catalogue fixed to that category.
 */
export async function CategoryView({
  locale,
  mainSlug,
  subSlug,
  query,
}: {
  locale: string;
  mainSlug: string;
  subSlug?: string;
  query: CatalogueQuery;
}) {
  const categories = await getCategories(true);
  const match = findCategory(categories, mainSlug, subSlug);
  if (match.kind === 'moved') redirect({ href: match.path, locale });
  if (match.kind !== 'found') notFound();

  const { main, sub } = match;
  const shown: CategoryNode = sub ?? main;
  const basePath = categoryPath(main.slug, sub?.slug);
  const [t, tCommon] = await Promise.all([getTranslations('Categories'), getTranslations('Common')]);

  const chip = (active: boolean) =>
    `inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-semibold transition-colors ${
      active
        ? 'border-primary bg-primary text-primary-foreground'
        : 'border-border bg-card hover:border-primary/40 hover:text-primary'
    }`;

  return (
    <>
      <PageHero
        kicker={sub ? main.name : t('kicker')}
        title={shown.name}
        subtitle={shown.description ?? tCommon('coursesCount', { count: shown.courseCount })}
        className="!pb-8"
      >
        <nav aria-label={t('breadcrumb')}>
          <ol className="flex flex-wrap items-center gap-1 text-sm text-muted-foreground">
            <li>
              <Link href="/courses" className="hover:text-primary">{t('allCourses')}</Link>
            </li>
            <li aria-hidden><ChevronRight className="size-4 rtl:rotate-180" /></li>
            <li>
              {sub ? (
                <Link href={categoryPath(main.slug)} className="hover:text-primary">{main.name}</Link>
              ) : (
                <span aria-current="page" className="font-semibold text-foreground">{main.name}</span>
              )}
            </li>
            {sub ? (
              <>
                <li aria-hidden><ChevronRight className="size-4 rtl:rotate-180" /></li>
                <li><span aria-current="page" className="font-semibold text-foreground">{sub.name}</span></li>
              </>
            ) : null}
          </ol>
        </nav>
      </PageHero>

      <div className="container flex flex-col gap-8 pb-16 lg:pb-24">
        {main.children.length ? (
          <nav aria-label={t('subcategories', { name: main.name })}>
            <ul className="flex flex-wrap gap-2">
              <li>
                <Link href={categoryPath(main.slug)} aria-current={sub ? undefined : 'page'} className={chip(!sub)}>
                  {t('allIn', { name: main.name })}
                  <span className="opacity-75">({main.courseCount})</span>
                </Link>
              </li>
              {main.children.map((child) => {
                const active = child.slug === sub?.slug;
                return (
                  <li key={child.id}>
                    <Link
                      href={categoryPath(main.slug, child.slug)}
                      aria-current={active ? 'page' : undefined}
                      className={chip(active)}
                    >
                      {child.name}
                      <span className="opacity-75">({child.courseCount})</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
        ) : null}

        <CourseCatalogue
          locale={locale}
          query={query}
          basePath={basePath}
          categories={categories}
          fixedCategory={shown.slug}
          trace
        />
      </div>
    </>
  );
}
