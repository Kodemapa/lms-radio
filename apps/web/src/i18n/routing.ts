import { defineRouting } from 'next-intl/routing';

export const routing = defineRouting({
  // English only (Hindi removed at the product owner's request, 2026-11-26). The i18n
  // setup stays: to add a language, list it here and add messages/<code>.json.
  locales: ['en'],
  defaultLocale: 'en',
});

export type AppLocale = (typeof routing.locales)[number];
