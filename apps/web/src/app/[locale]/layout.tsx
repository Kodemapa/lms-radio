import { type Metadata } from 'next';
import { hasLocale, NextIntlClientProvider } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Bricolage_Grotesque, Geist, Noto_Sans_Devanagari } from 'next/font/google';
import { notFound } from 'next/navigation';
import { type ReactNode } from 'react';
import { routing } from '@/i18n/routing';
import '../globals.css';

const geist = Geist({ subsets: ['latin'], variable: '--font-geist', display: 'swap' });
// Rounded, friendly display face for landing-page headings.
const display = Bricolage_Grotesque({
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
});
// Not preloaded: Google's CSS for this family has no subset markers for Next to
// pick a file from, and only Hindi pages need it.
const devanagari = Noto_Sans_Devanagari({
  weight: ['400', '500', '600', '700'],
  variable: '--font-devanagari',
  display: 'swap',
  preload: false,
});

type Props = { children: ReactNode; params: Promise<{ locale: string }> };

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: Omit<Props, 'children'>): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Common' });
  return {
    title: { default: t('appName'), template: `%s · ${t('appName')}` },
    description: t('tagline'),
  };
}

export default async function LocaleLayout({ children, params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations('Common');

  return (
    // Browser extensions (screen recorders, password managers, Grammarly) add their own
    // attributes to <html> and <body> before React loads. That is not our markup, so
    // attribute differences on these two elements are not reported as hydration errors.
    // This applies only to these elements, not to anything inside them.
    <html lang={locale} className={`${geist.variable} ${display.variable} ${devanagari.variable}`} suppressHydrationWarning>
      <body className="flex min-h-dvh flex-col bg-background font-sans text-foreground antialiased" suppressHydrationWarning>
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground"
        >
          {t('skipToContent')}
        </a>
        <NextIntlClientProvider>{children}</NextIntlClientProvider>
      </body>
    </html>
  );
}
