import { Activity, AudioLines, Ruler, ScanLine, Siren, Stethoscope } from 'lucide-react';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { PageHero } from '@/components/layout/page-hero';

// Tones reuse the landing page's pathway palette so the two pages read as one family.
const SIMULATORS = [
  { key: 'fetalUltrasound', Icon: ScanLine, tone: 'bg-[#ece3f8] text-[#6a52a3]' },
  { key: 'biometry', Icon: Ruler, tone: 'bg-[#fcd9bb] text-[#9a4b14]' },
  { key: 'doppler', Icon: AudioLines, tone: 'bg-[#f8e4e6] text-[#9b3550]' },
  { key: 'ctg', Icon: Activity, tone: 'bg-[#e5ecdf] text-[#3d6b2a]' },
  { key: 'gynae', Icon: Stethoscope, tone: 'bg-[#ece3f8] text-[#6a52a3]' },
  { key: 'labourWard', Icon: Siren, tone: 'bg-[#fcd9bb] text-[#9a4b14]' },
] as const;

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Simulators' });
  return { title: t('title') };
}

export default async function SimulatorsPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('Simulators');

  return (
    <>
      <PageHero kicker={t('kicker')} title={t('title')} subtitle={t('intro')} />
      <div className="container pb-16 pt-2 lg:pb-24">
        <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {SIMULATORS.map(({ key, Icon, tone }, i) => (
            <li key={key} className="surface lift flex h-full flex-col gap-4 p-6">
              <div className="flex items-start justify-between gap-3">
                <span className={`grid size-12 place-items-center rounded-2xl ${tone}`}>
                  <Icon aria-hidden className="size-5" />
                </span>
                <span className="rounded-full bg-accent-light px-3 py-1 text-xs font-semibold text-accent-deep">
                  {t('planned')}
                </span>
              </div>
              <div>
                <p className="mb-1 text-xs font-semibold text-muted-foreground" aria-hidden>
                  0{i + 1}
                </p>
                <h2 className="text-xl font-semibold">{t(`items.${key}.title`)}</h2>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {t(`items.${key}.body`)}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}
