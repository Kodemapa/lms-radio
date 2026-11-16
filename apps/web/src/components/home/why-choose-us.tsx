import { Activity, BadgeCheck, ShieldCheck, Stethoscope } from 'lucide-react';
import { getTranslations } from 'next-intl/server';

const ITEMS = [
  { key: 'simulators', Icon: Activity },
  { key: 'protection', Icon: ShieldCheck },
  { key: 'faculty', Icon: BadgeCheck },
  { key: 'compliance', Icon: Stethoscope },
] as const;

export async function WhyChooseUs() {
  const t = await getTranslations('Home');
  return (
    <section aria-labelledby="why" className="section-gap bg-secondary text-secondary-foreground">
      <div className="container">
        <h2 id="why" className="section-title mb-8 text-center">
          {t('whyTitle')}
        </h2>
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {ITEMS.map(({ key, Icon }) => (
            <li key={key} className="flex flex-col gap-3 rounded-2xl bg-white/5 p-6">
              <span className="w-fit rounded-xl bg-primary p-3 text-primary-foreground">
                <Icon aria-hidden className="size-6" />
              </span>
              <h3 className="text-lg font-semibold">{t(`why.${key}.title`)}</h3>
              <p className="text-sm opacity-80">{t(`why.${key}.body`)}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
