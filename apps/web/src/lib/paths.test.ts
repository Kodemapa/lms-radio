import { describe, expect, it } from 'vitest';
import { isProtectedPath, localeFromPath, safeNextPath } from './paths';

describe('isProtectedPath', () => {
  it.each(['/en/learn/abc', '/hi/learn', '/en/learn/', '/en/instructor', '/hi/instructor/courses/x', '/en/account/learning'])('protects %s', (p) =>
    expect(isProtectedPath(p)).toBe(true),
  );
  it.each(['/en', '/en/courses', '/en/learning-paths', '/learn/abc', '/en/instructors', '/en/instructors/abc'])('allows %s', (p) =>
    expect(isProtectedPath(p)).toBe(false),
  );
});

describe('localeFromPath', () => {
  it('reads a known locale', () => expect(localeFromPath('/hi/learn/x')).toBe('hi'));
  it('falls back for unknown locales', () => expect(localeFromPath('/fr/x')).toBe('en'));
});

describe('safeNextPath', () => {
  it('keeps relative paths', () => expect(safeNextPath('/en/learn/1', '/en')).toBe('/en/learn/1'));
  it.each(['//evil.com', 'https://evil.com', '/\\evil.com', '', null, undefined])(
    'rejects %p',
    (next) => expect(safeNextPath(next, '/en')).toBe('/en'),
  );
});
