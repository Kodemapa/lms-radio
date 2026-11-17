import { type Metadata } from 'next';
import { hasLocale, NextIntlClientProvider } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Bricolage_Grotesque, Geist, Noto_Sans_Devanagari } from 'next/font/google';
import { notFound } from 'next/navigation';
import { type ReactNode } from 'react';
import { routing } from '@/i18n/routing';
import { getPublicSiteSettings, SITE_URL } from '@/lib/site-settings';
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
  const [t, settings] = await Promise.all([
    getTranslations({ locale, namespace: 'Common' }),
    getPublicSiteSettings(),
  ]);
  const appName = settings.seoTitle || t('appName');
  const description = settings.seoDescription || t('tagline');
  const images = settings.ogImageUrl ? [{ url: settings.ogImageUrl }] : undefined;
  return {
    metadataBase: new URL(SITE_URL),
    title: { default: appName, template: `%s · ${appName}` },
    description,
    openGraph: { siteName: appName, title: appName, description, locale, type: 'website', images },
    twitter: {
      card: images ? 'summary_large_image' : 'summary',
      title: appName,
      description,
      images: images?.map((image) => image.url),
    },
    ...(settings.allowIndexing ? {} : { robots: { index: false, follow: false } }),
  };
}

export default async function LocaleLayout({ children, params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations('Common');

  return (
    <html lang={locale} className={`${geist.variable} ${display.variable} ${devanagari.variable}`}>
      <body className="flex min-h-dvh flex-col bg-background font-sans text-foreground antialiased">
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
