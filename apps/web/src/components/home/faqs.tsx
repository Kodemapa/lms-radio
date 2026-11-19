import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@obgyn/ui';
import Image from 'next/image';
import { FaqSchema } from '@obgyn/types';
import { getLocale, getTranslations } from 'next-intl/server';
import { z } from 'zod';
import { apiGet } from '@/lib/server-api';
import skillsLab from './images/skills-lab.webp';
import { Reveal } from './reveal';

const QUESTIONS = ['1', '5', '6', '2', '3', '4'] as const;
/** The home page shows the first few; the full list is on /faq. */
const HOME_LIMIT = 6;

export async function Faqs() {
  const [t, locale] = await Promise.all([getTranslations('Home'), getLocale()]);
  // Admin-managed FAQs (Admin → FAQs). The built-in texts are only a fallback
  // when none are published or the API is unreachable.
  const managed = await apiGet(`/content/faqs?locale=${encodeURIComponent(locale)}`, z.array(FaqSchema)).catch(() => []);
  const items = managed.length
    ? managed.slice(0, HOME_LIMIT).map((faq) => ({ key: faq.id, question: faq.question, answer: faq.answer }))
    : QUESTIONS.map((n) => ({ key: n, question: t(`faq.q${n}`), answer: t(`faq.a${n}`) }));
  return (
    <section aria-labelledby="faqs" className="lp-section">
      <div className="container lp-faq">
        <Reveal variant="left" className="lp-faq-side">
          <p className="lp-kicker">{t('faqEyebrow')}</p>
          <h2 id="faqs" className="lp-title">
            {t('faqTitle')}
          </h2>
          <figure className="lp-faq-photo">
            <Image
              src={skillsLab}
              alt={t('img.skillsLab')}
              placeholder="blur"
              sizes="(min-width: 1024px) 420px, 90vw"
            />
          </figure>
        </Reveal>
        <Reveal variant="right" delay={120}>
          <Accordion type="single" collapsible className="lp-accordion">
            {items.map((item) => (
              <AccordionItem key={item.key} value={item.key}>
                <AccordionTrigger>{item.question}</AccordionTrigger>
                <AccordionContent className="whitespace-pre-line text-muted-foreground">
                  {item.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </Reveal>
      </div>
    </section>
  );
}
