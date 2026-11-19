import { type CategoryNode } from '@obgyn/types';
import { describe, expect, it } from 'vitest';
import { categoryHref, categoryPath, findCategory } from './categories';

const node = (slug: string, children: CategoryNode[] = []): CategoryNode => ({
  id: slug,
  slug,
  name: slug,
  description: null,
  courseCount: 0,
  children,
});

const tree = [node('ultrasound', [node('fetal-biometry'), node('doppler')]), node('obstetrics', [node('labour')])];

describe('findCategory', () => {
  it('finds a main category', () => {
    const match = findCategory(tree, 'ultrasound');
    expect(match).toMatchObject({ kind: 'found', main: { slug: 'ultrasound' }, sub: null });
  });

  it('finds a sub-category under its parent', () => {
    const match = findCategory(tree, 'ultrasound', 'doppler');
    expect(match).toMatchObject({ kind: 'found', main: { slug: 'ultrasound' }, sub: { slug: 'doppler' } });
  });

  it('redirects a sub-category opened as a main category', () => {
    expect(findCategory(tree, 'doppler')).toEqual({ kind: 'moved', path: '/categories/ultrasound/doppler' });
  });

  it('redirects a sub-category opened under the wrong parent', () => {
    expect(findCategory(tree, 'obstetrics', 'doppler')).toEqual({ kind: 'moved', path: '/categories/ultrasound/doppler' });
  });

  it.each([
    ['unknown', undefined],
    ['ultrasound', 'unknown'],
    ['Ultrasound', undefined],
    ['ultrasound', '../admin'],
    ['', undefined],
  ])('is missing for %s / %s', (main, sub) => {
    expect(findCategory(tree, main, sub)).toEqual({ kind: 'missing' });
  });
});

describe('categoryHref', () => {
  it('links main and sub-categories to their pages', () => {
    expect(categoryHref(tree, 'obstetrics')).toBe('/categories/obstetrics');
    expect(categoryHref(tree, 'labour')).toBe('/categories/obstetrics/labour');
  });

  it('falls back to the filtered catalogue for an unknown slug', () => {
    expect(categoryHref(tree, 'gone')).toBe('/courses?category=gone');
  });

  it('builds paths', () => {
    expect(categoryPath('a')).toBe('/categories/a');
    expect(categoryPath('a', 'b')).toBe('/categories/a/b');
  });
});
