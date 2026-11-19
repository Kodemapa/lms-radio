import { ArrowUpRight, Mail, MapPin, Phone } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { LEGAL_PAGE_SLUGS } from '@obgyn/types';
import { Link } from '@/i18n/navigation';
import { getPublicSiteSettings } from '@/lib/site-settings';
import { Brand } from './brand';

/** Contact details shown in the footer; set these for your organisation. */
const CONTACT = {
  email: process.env.NEXT_PUBLIC_CONTACT_EMAIL ?? 'support@example.com',
  address: process.env.NEXT_PUBLIC_CONTACT_ADDRESS ?? 'India',
};

const linkClass = 'text-white/70 transition-colors hover:text-white';

export async function SiteFooter() {
  const [t, tCommon, settings] = await Promise.all([
    getTranslations('Footer'),
    getTranslations('Common'),
    getPublicSiteSettings(),
  ]);
  const email = settings.supportEmail || CONTACT.email;
  const address = settings.address || CONTACT.address;
  const year = new Date().getFullYear();

  return (
    <footer className="mt-auto px-2 pb-2 sm:px-3 sm:pb-3">
      {/* Plum panel with grain and warm glows, matching the landing page's dark band. */}
      <div
        className="relative isolate overflow-hidden rounded-[28px] bg-footer text-white/75 sm:rounded-[36px]"
        style={{
          backgroundImage:
            'var(--grain), radial-gradient(55% 70% at 0% 0%, #4a3570 0%, transparent 60%), radial-gradient(45% 70% at 100% 100%, #6b3d4f 0%, transparent 60%)',
          backgroundBlendMode: 'soft-light, normal, normal',
        }}
      >
        <div className="container flex flex-col gap-12 py-12 md:py-16">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="flex items-center gap-4 rounded-3xl border border-white/10 bg-white/[0.06] p-5 backdrop-blur">
              <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-[#fcd9bb] to-[#ef8746] text-[#2f2340]">
                <MapPin aria-hidden className="size-5" />
              </span>
              <div>
                <p className="font-semibold text-white sm:text-lg">{t('contactTitle')}</p>
                <p className="text-sm">{address}</p>
              </div>
            </div>
            <a
              href={`mailto:${email}`}
              className="group flex items-center gap-4 rounded-3xl border border-white/10 bg-white/[0.06] p-5 backdrop-blur transition-colors hover:bg-white/10"
            >
              <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-[#e3d4fb] to-[#b49cf0] text-[#2f2340]">
                <Mail aria-hidden className="size-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-white sm:text-lg">{t('emailUs')}</p>
                <p className="truncate text-sm">{email}</p>
              </div>
              <ArrowUpRight
                aria-hidden
                className="size-5 shrink-0 text-white/50 transition-transform group-hover:rotate-45 group-hover:text-white"
              />
            </a>
            {settings.supportPhone ? (
              <a
                href={`tel:${settings.supportPhone}`}
                className="group flex items-center gap-4 rounded-3xl border border-white/10 bg-white/[0.06] p-5 backdrop-blur transition-colors hover:bg-white/10"
              >
                <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-[#d5f0e2] to-[#9ecfb1] text-[#2f2340]">
                  <Phone aria-hidden className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-white sm:text-lg">{t('callUs')}</p>
                  <p className="truncate text-sm">{settings.supportPhone}</p>
                </div>
              </a>
            ) : null}
          </div>

          <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
            <div className="flex flex-col gap-4 lg:col-span-2">
              <Brand name={tCommon('appName')} inverted />
              <p className="max-w-md text-sm leading-relaxed">{t('about')}</p>
              <p className="max-w-md text-xs text-white/50">{tCommon('pcpndt')}</p>
            </div>
            <nav aria-labelledby="footer-links">
              <h2 id="footer-links" className="mb-5 text-lg font-semibold text-white">
                {t('usefulLinks')}
              </h2>
              <ul className="flex flex-col gap-3 text-sm">
                <li><Link href="/" className={linkClass}>{tCommon('home')}</Link></li>
                <li><Link href="/courses" className={linkClass}>{tCommon('courses')}</Link></li>
                <li><Link href="/instructors" className={linkClass}>{tCommon('instructors')}</Link></li>
                <li><Link href="/simulators" className={linkClass}>{tCommon('simulators')}</Link></li>
                <li><Link href="/become-instructor" className={linkClass}>{tCommon('becomeInstructor')}</Link></li>
                <li><Link href="/faq" className={linkClass}>{t('faq')}</Link></li>
                <li><Link href="/contact" className={linkClass}>{t('contact')}</Link></li>
              </ul>
            </nav>
            <nav aria-labelledby="footer-legal">
              <h2 id="footer-legal" className="mb-5 text-lg font-semibold text-white">
                {t('legal')}
              </h2>
              <ul className="flex flex-col gap-3 text-sm">
                {LEGAL_PAGE_SLUGS.map((slug) => (
                  <li key={slug}>
                    <Link href={`/pages/${slug}`} className={linkClass}>{t(slug)}</Link>
                  </li>
                ))}
              </ul>
            </nav>
          </div>

          <div className="flex flex-col items-center gap-1.5 border-t border-white/10 pt-6 text-center text-sm text-white/50">
            <p>{t('copyright', { year, appName: tCommon('appName') })}</p>
            <p>
              {t('designedBy')}{' '}
              <a
                href="https://kodemapa.co.in"
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-white/80 underline-offset-4 transition-colors hover:text-white hover:underline"
              >
                kodemapa
                <span className="sr-only"> ({t('opensInNewTab')})</span>
              </a>
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
