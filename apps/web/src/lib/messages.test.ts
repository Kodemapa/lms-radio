import { describe, expect, it } from 'vitest';
import en from '../../messages/en.json';
import hi from '../../messages/hi.json';

type Tree = { [key: string]: string | Tree };
const keys = (tree: Tree, prefix = ''): string[] =>
  Object.entries(tree).flatMap(([key, value]) =>
    typeof value === 'string' ? [prefix + key] : keys(value, `${prefix}${key}.`),
  );

describe('message catalogs', () => {
  it('Hindi has exactly the same keys as English', () => {
    expect(keys(hi as Tree).sort()).toEqual(keys(en as Tree).sort());
  });
});
