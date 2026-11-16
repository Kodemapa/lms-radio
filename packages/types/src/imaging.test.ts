import { describe, expect, it } from 'vitest';
import {
  AnnotationDictionarySchema,
  AnnotationKeySchema,
  FindingKeySchema,
  labelCode,
  normalizeLabel,
  STANDARD_BIOMETRY_TERMS,
  type AnnotationTerm,
} from './imaging';

const ASSET = '6f1c2a3b-0000-4000-8000-000000000001';
const dict: AnnotationTerm[] = [
  { abbr: 'CSP', name: 'Cavum septi pellucidi', description: null, loinc: null, tools: ['POINT'] },
  { abbr: 'HC', name: 'Head circumference', description: null, loinc: '11984-2', tools: ['ELLIPSE'] },
];

describe('annotation labels', () => {
  it('matches case- and space-insensitively', () => {
    expect(normalizeLabel('  csp ')).toBe('CSP');
    expect(labelCode('csp', dict)).toEqual(labelCode('CSP', dict));
  });

  it('uses LOINC for standard terms and the local scheme otherwise', () => {
    expect(labelCode('hc', dict)).toEqual({ value: '11984-2', scheme: 'LN', meaning: 'Head circumference' });
    expect(labelCode('CSP', dict)).toEqual({ value: 'CSP', scheme: '99OBGLMS', meaning: 'Cavum septi pellucidi' });
    // built-in biometry works even if the course dictionary lacks it
    expect(labelCode('FL', []).value).toBe('11963-6');
    // free labels get a local code that cannot collide with a different abbreviation
    expect(labelCode('my thing', dict)).toEqual({ value: 'MY THING', scheme: '99OBGLMS', meaning: 'my thing' });
  });

  it('rejects duplicate abbreviations in a dictionary', () => {
    expect(AnnotationDictionarySchema.safeParse([...dict, { ...dict[0]!, abbr: 'csp' }]).success).toBe(false);
    expect(AnnotationDictionarySchema.safeParse(STANDARD_BIOMETRY_TERMS).success).toBe(true);
  });
});

describe('answer key rules', () => {
  const base = { id: 'a1', label: 'CSP', assetId: ASSET, marks: 1 };
  it('needs a pin radius for points and an overlap for regions', () => {
    expect(AnnotationKeySchema.safeParse({ ...base, tool: 'POINT', coords: [[1, 2]] }).success).toBe(false);
    expect(AnnotationKeySchema.safeParse({ ...base, tool: 'POINT', coords: [[1, 2]], radiusPercent: 5 }).success).toBe(true);
    expect(AnnotationKeySchema.safeParse({ ...base, tool: 'BOX', coords: [[1, 2], [5, 6]] }).success).toBe(false);
    expect(AnnotationKeySchema.safeParse({ ...base, tool: 'BOX', coords: [[1, 2], [5, 6]], iouFull: 0.5, iouHalf: 0.3 }).success).toBe(true);
    expect(AnnotationKeySchema.safeParse({ ...base, tool: 'BOX', coords: [[1, 2], [5, 6]], iouFull: 0.3, iouHalf: 0.5 }).success).toBe(false);
  });

  it('checks the drawing has the right number of points', () => {
    expect(AnnotationKeySchema.safeParse({ ...base, tool: 'POLYGON', coords: [[1, 2], [3, 4]], iouFull: 0.5 }).success).toBe(false);
  });

  it('single-answer findings have exactly one correct option', () => {
    const finding = { id: 'f1', label: 'Q', marks: 1, options: [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }] };
    expect(FindingKeySchema.safeParse({ ...finding, correctOptionIds: ['a', 'b'] }).success).toBe(false);
    expect(FindingKeySchema.safeParse({ ...finding, multiple: true, correctOptionIds: ['a', 'b'] }).success).toBe(true);
    expect(FindingKeySchema.safeParse({ ...finding, correctOptionIds: ['z'] }).success).toBe(false);
  });
});
