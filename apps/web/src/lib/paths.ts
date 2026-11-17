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
