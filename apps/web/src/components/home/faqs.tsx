import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@obgyn/ui';
import Image from 'next/image';
import { getTranslations } from 'next-intl/server';
import skillsLab from './images/skills-lab.webp';
import { Reveal } from './reveal';

const QUESTIONS = ['1', '5', '6', '2', '3', '4'] as const;

export async function Faqs() {
  const t = await getTranslations('Home');
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
            {QUESTIONS.map((n) => (
              <AccordionItem key={n} value={n}>
                <AccordionTrigger>{t(`faq.q${n}`)}</AccordionTrigger>
                <AccordionContent className="text-muted-foreground">
                  {t(`faq.a${n}`)}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </Reveal>
      </div>
    </section>
  );
}
