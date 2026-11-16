import { describe, expect, it } from 'vitest';
import { readResources, ResourceLinkSchema } from './resources.js';

const link = (url: string) => ResourceLinkSchema.safeParse({ id: 'c1', title: 'EFW', url });

describe('resource links', () => {
  it('accepts https calculator links', () => {
    expect(link('https://www.fetalmedicine.org/website/calculators').success).toBe(true);
  });
  it('rejects http, javascript: and credentials in links', () => {
    expect(link('http://perinatology.com/').success).toBe(false);
    expect(link('javascript:alert(1)').success).toBe(false);
    expect(link('https://user:pw@example.com/').success).toBe(false);
  });
  it('drops stored links that no longer validate', () => {
    expect(readResources([{ id: 'a', title: 'ok', url: 'https://perinatology.com/' }, { id: 'b', title: 'bad', url: 'javascript:x' }, 'junk']).map((r) => r.id)).toEqual(['a']);
    expect(readResources(null)).toEqual([]);
  });
});
