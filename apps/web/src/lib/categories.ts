import { type CategoryNode } from '@obgyn/types';

/** Category slugs are lowercase words joined by hyphens (as the admin editor saves them). */
export const CATEGORY_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export type CategoryMatch =
  /** The requested main category (and, if asked for, its sub-category). */
  | { kind: 'found'; main: CategoryNode; sub: CategoryNode | null }
  /** The slug is a sub-category reached by the wrong path: send the visitor to its canonical URL. */
  | { kind: 'moved'; path: string }
  | { kind: 'missing' };

/** Learner URL of a category: `/categories/<main>` or `/categories/<main>/<sub>`. */
export function categoryPath(main: string, sub?: string | null): string {
  return sub ? `/categories/${main}/${sub}` : `/categories/${main}`;
}

/**
 * Resolves `/categories/<main>[/<sub>]` against the two-level category tree.
 * A sub-category opened as a main one (or under the wrong parent) resolves to
 * `moved`, so old or hand-typed links still land on the right page.
 */
export function findCategory(tree: CategoryNode[], mainSlug: string, subSlug?: string): CategoryMatch {
  if (!CATEGORY_SLUG.test(mainSlug) || (subSlug !== undefined && !CATEGORY_SLUG.test(subSlug))) return { kind: 'missing' };

  const parentOf = (slug: string) => tree.find((root) => root.children.some((child) => child.slug === slug));
  const main = tree.find((root) => root.slug === mainSlug);

  if (subSlug === undefined) {
    if (main) return { kind: 'found', main, sub: null };
    const parent = parentOf(mainSlug);
    return parent ? { kind: 'moved', path: categoryPath(parent.slug, mainSlug) } : { kind: 'missing' };
  }

  const sub = main?.children.find((child) => child.slug === subSlug);
  if (main && sub) return { kind: 'found', main, sub };
  const parent = parentOf(subSlug);
  return parent ? { kind: 'moved', path: categoryPath(parent.slug, subSlug) } : { kind: 'missing' };
}

/** Category URL for a course's category slug (main or sub). Falls back to the filtered catalogue. */
export function categoryHref(tree: CategoryNode[], slug: string): string {
  if (tree.some((root) => root.slug === slug)) return categoryPath(slug);
  const parent = tree.find((root) => root.children.some((child) => child.slug === slug));
  return parent ? categoryPath(parent.slug, slug) : `/courses?category=${encodeURIComponent(slug)}`;
}
