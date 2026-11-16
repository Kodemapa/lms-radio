import { defineRouting } from 'next-intl/routing';

export const routing = defineRouting({
  // English first; Hindi from day one. Add regional languages here + in /messages.
  locales: ['en', 'hi'],
  defaultLocale: 'en',
});

export type AppLocale = (typeof routing.locales)[number];
