import { Mail, MapPin } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { Brand } from './brand';

/** Contact details shown in the footer; set these for your organisation. */
const CONTACT = {
  email: process.env.NEXT_PUBLIC_CONTACT_EMAIL ?? 'support@example.com',
  address: process.env.NEXT_PUBLIC_CONTACT_ADDRESS ?? 'India',
};

export async function SiteFooter() {
  const [t, tCommon] = await Promise.all([getTranslations('Footer'), getTranslations('Common')]);
  const year = new Date().getFullYear();

  return (
    <footer className="mt-auto bg-footer text-gray-300">
      <div className="container flex flex-col gap-10 py-12 md:gap-14">
        <div className="grid gap-6 rounded-2xl bg-footer-panel p-6 md:grid-cols-2 md:p-8">
          <div className="flex items-center gap-4">
            <span className="rounded-full bg-white/10 p-3">
              <MapPin aria-hidden className="size-6 text-white" />
            </span>
            <div>
              <p className="font-semibold text-white sm:text-lg">{t('contactTitle')}</p>
              <p className="text-sm">{CONTACT.address}</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <span className="rounded-full bg-white/10 p-3">
              <Mail aria-hidden className="size-6 text-white" />
            </span>
            <div>
              <p className="font-semibold text-white sm:text-lg">{t('emailUs')}</p>
              <a href={`mailto:${CONTACT.email}`} className="text-sm hover:text-white">
                {CONTACT.email}
              </a>
            </div>
          </div>
        </div>

        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <div className="flex flex-col gap-4 lg:col-span-2">
            <Brand name={tCommon('appName')} inverted />
            <p className="max-w-md text-sm leading-relaxed">{t('about')}</p>
            <p className="max-w-md text-xs text-gray-400">{tCommon('pcpndt')}</p>
          </div>
          <nav aria-labelledby="footer-links">
            <h2 id="footer-links" className="mb-5 text-lg font-semibold text-white">
              {t('usefulLinks')}
            </h2>
            <ul className="flex flex-col gap-3 text-sm">
              <li><Link href="/" className="hover:text-white">{tCommon('home')}</Link></li>
              <li><Link href="/courses" className="hover:text-white">{tCommon('courses')}</Link></li>
              <li><Link href="/instructors" className="hover:text-white">{tCommon('instructors')}</Link></li>
              <li><Link href="/simulators" className="hover:text-white">{tCommon('simulators')}</Link></li>
              <li><Link href="/become-instructor" className="hover:text-white">{tCommon('becomeInstructor')}</Link></li>
            </ul>
          </nav>
          <nav aria-labelledby="footer-legal">
            <h2 id="footer-legal" className="mb-5 text-lg font-semibold text-white">
              {t('legal')}
            </h2>
            <ul className="flex flex-col gap-3 text-sm">
              <li><span>{t('privacy')}</span></li>
              <li><span>{t('terms')}</span></li>
              <li><span>{t('refund')}</span></li>
            </ul>
          </nav>
        </div>
      </div>
      <div className="bg-footer-panel py-5 text-center text-sm">
        {t('copyright', { year, appName: tCommon('appName') })}
      </div>
    </footer>
  );
}
