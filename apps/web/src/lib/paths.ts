import { routing } from '@/i18n/routing';

const localeGroup = routing.locales.join('|');
const PROTECTED = new RegExp(`^/(${localeGroup})/(learn|instructor|account|admin)(/|$)`);

/** Pages that need a signed-in user. */
export function isProtectedPath(pathname: string): boolean {
  return PROTECTED.test(pathname);
}

export function localeFromPath(pathname: string): string {
  const first = pathname.split('/')[1] ?? '';
  return (routing.locales as readonly string[]).includes(first) ? first : routing.defaultLocale;
}

/**
 * Only allow same-origin relative redirects ("/en/courses"), never "//evil.com"
 * or "https://…", so ?next= cannot be used as an open redirect.
 */
export function safeNextPath(next: string | null | undefined, fallback: string): string {
  if (!next || !next.startsWith('/') || next.startsWith('//') || next.includes('\\')) {
    return fallback;
  }
  return next;
}

/** Each role's own landing page after signing in. */
export function roleHome(role: string | null | undefined, locale: string): string {
  if (role === 'ADMIN') return `/${locale}/admin`;
  if (role === 'FACULTY') return `/${locale}/instructor`;
  return `/${locale}/courses`;
}

/**
 * Where to go after signing in. `next` (the page that sent the user to sign in) is followed
 * only if it belongs to the role that just signed in: the admin area for admins, the
 * instructor area for instructors. `next` often comes from the previous account's session
 * ending on its dashboard (a different person may sign in on this browser), so an admin
 * must not be sent into the instructor dashboard, or an instructor into the admin area.
 * Any other page (a course, a lesson, the account area) is followed as before.
 */
export function postLoginPath(next: string | null | undefined, role: string | null | undefined, locale: string): string {
  const home = roleHome(role, locale);
  const target = safeNextPath(next, home);
  const area = target.replace(/^\/(en|hi)(?=\/|$)/, '').split(/[/?#]/)[1] ?? '';
  if (area === 'admin' && role !== 'ADMIN') return home;
  if (area === 'instructor' && role !== 'FACULTY') return home;
  return target;
}
