import { Mail, MapPin, Phone } from 'lucide-react';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { ContactForm } from '@/components/contact-form';
import { getPublicSiteSettings } from '@/lib/site-settings';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Contact' });
  return { title: t('title') };
}

export default async function ContactPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const [t, settings] = await Promise.all([getTranslations('Contact'), getPublicSiteSettings()]);
  const details = [
    settings.supportEmail ? { icon: Mail, label: t('emailLabel'), value: settings.supportEmail, href: `mailto:${settings.supportEmail}` } : null,
    settings.supportPhone ? { icon: Phone, label: t('phoneLabel'), value: settings.supportPhone, href: `tel:${settings.supportPhone}` } : null,
    settings.address ? { icon: MapPin, label: t('addressLabel'), value: settings.address, href: null } : null,
  ].filter((detail) => detail !== null);

  return (
    <section className="container section-gap max-w-5xl">
      <header className="mb-8 max-w-2xl">
        <h1 className="section-title">{t('title')}</h1>
        <p className="mt-3 text-muted-foreground">{t('intro')}</p>
      </header>
      <div className="grid gap-8 lg:grid-cols-[1fr_18rem]">
        <ContactForm />
        {details.length ? (
          <aside aria-label={t('detailsTitle')} className="flex flex-col gap-4">
            {details.map(({ icon: Icon, label, value, href }) => (
              <div key={label} className="surface flex items-start gap-3 rounded-2xl p-4">
                <Icon aria-hidden className="mt-0.5 size-5 shrink-0 text-primary" />
                <div className="min-w-0">
                  <p className="text-sm font-semibold">{label}</p>
                  {href ? (
                    <a href={href} className="break-words text-sm text-muted-foreground hover:text-primary">{value}</a>
                  ) : (
                    <p className="whitespace-pre-line text-sm text-muted-foreground">{value}</p>
                  )}
                </div>
              </div>
            ))}
          </aside>
        ) : null}
      </div>
    </section>
  );
}
