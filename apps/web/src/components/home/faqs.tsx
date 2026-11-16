import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@obgyn/ui';
import { getTranslations } from 'next-intl/server';

const QUESTIONS = ['1', '2', '3', '4'] as const;

export async function Faqs() {
  const t = await getTranslations('Home');
  return (
    <section aria-labelledby="faqs" className="section-gap">
      <div className="container max-w-3xl">
        <h2 id="faqs" className="section-title mb-8 text-center">
          {t('faqTitle')}
        </h2>
        <Accordion type="single" collapsible className="flex flex-col gap-3">
          {QUESTIONS.map((n) => (
            <AccordionItem key={n} value={n}>
              <AccordionTrigger>{t(`faq.q${n}`)}</AccordionTrigger>
              <AccordionContent className="text-muted-foreground">{t(`faq.a${n}`)}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
}
