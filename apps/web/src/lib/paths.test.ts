import { describe, expect, it } from 'vitest';
import { isProtectedPath, localeFromPath, postLoginPath, roleHome, safeNextPath } from './paths';

describe('isProtectedPath', () => {
  it.each([
    '/en/learn/abc',
    '/hi/learn',
    '/en/learn/',
    '/en/instructor',
    '/hi/instructor/courses/x',
    '/en/account/learning',
    '/en/admin',
    '/hi/admin/categories',
  ])('protects %s', (p) =>
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

describe('role-based sign-in landing', () => {
  it('sends an admin away from a prior instructor dashboard', () => {
    expect(postLoginPath('/en/instructor', 'ADMIN', 'en')).toBe('/en/admin');
  });

  it('sends a faculty member away from a prior admin dashboard', () => {
    expect(postLoginPath('/en/admin/users', 'FACULTY', 'en')).toBe('/en/instructor');
  });

  it('keeps destinations that are valid for the signed-in role', () => {
    expect(postLoginPath('/hi/courses?sort=popular', 'LEARNER', 'hi')).toBe('/hi/courses?sort=popular');
    expect(postLoginPath('/en/instructor/courses', 'FACULTY', 'en')).toBe('/en/instructor/courses');
  });

  it('uses the role landing page when there is no compatible next page', () => {
    expect(roleHome('ADMIN', 'en')).toBe('/en/admin');
    expect(postLoginPath(null, 'LEARNER', 'en')).toBe('/en/courses');
  });
});
