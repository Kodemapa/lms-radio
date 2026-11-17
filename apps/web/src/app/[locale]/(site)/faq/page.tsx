import { FaqSchema } from '@obgyn/types';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { z } from 'zod';
import { apiGet } from '@/lib/server-api';

export default async function FaqPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const [t, faqs] = await Promise.all([
    getTranslations('PublicContent'),
    apiGet(`/content/faqs?locale=${encodeURIComponent(locale)}`, z.array(FaqSchema)),
  ]);
  return (
    <section className="container section-gap max-w-3xl">
      <h1 className="section-title mb-8">{t('faqTitle')}</h1>
      {faqs.length ? (
        <div className="flex flex-col gap-3">
          {faqs.map((faq) => (
            <details key={faq.id} className="surface rounded-2xl p-5">
              <summary className="cursor-pointer font-semibold">{faq.question}</summary>
              <p className="mt-3 whitespace-pre-wrap text-muted-foreground">{faq.answer}</p>
            </details>
          ))}
        </div>
      ) : (
        <p className="rounded-2xl border border-dashed border-border p-8 text-center text-muted-foreground">{t('faqEmpty')}</p>
      )}
    </section>
  );
}
