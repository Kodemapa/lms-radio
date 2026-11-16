import { ArrowUpRight, Calculator, ClipboardCheck, Crosshair, Ruler } from 'lucide-react';
import Image from 'next/image';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import studentScanning from './images/student-scanning.webp';
import { Reveal } from './reveal';

// What every DICOM case already offers learners (see docs/PROGRESS.md §2).
const TOOLS = [
  { key: 'measure', Icon: Ruler },
  { key: 'mark', Icon: Crosshair },
  { key: 'report', Icon: ClipboardCheck },
  { key: 'working', Icon: Calculator },
] as const;

// Planned work (docs/TODO.md): LIV-1, COMM-1, IMG-5, IMG-9, IMG-6.
const SOON = ['live', 'qa', 'ownScan', 'osce', 'cine'] as const;

/** Dark feature band: the imaging toolkit that exists today, and what's next. */
export async function PracticeBand() {
  const t = await getTranslations('Home');
  return (
    <section aria-labelledby="practice" className="lp-band">
      <div className="lp-band-photo" aria-hidden>
        <Image
          src={studentScanning}
          alt=""
          placeholder="blur"
          sizes="(min-width: 1024px) 40vw, 100vw"
        />
      </div>
      <div className="container lp-band-inner">
        <Reveal className="lp-band-head">
          <p className="lp-kicker lp-kicker-light">{t('practice.eyebrow')}</p>
          <h2 id="practice" className="lp-title">
            {t('practice.title')}
          </h2>
          <p>{t('practice.body')}</p>
        </Reveal>
        <ul className="lp-tasks">
          {TOOLS.map(({ key, Icon }, i) => (
            <Reveal as="li" key={key} delay={i * 80} variant="scale">
              <div className="lp-task">
                <span className="lp-task-icon">
                  <Icon aria-hidden className="size-5" />
                </span>
                <h3>{t(`practice.tools.${key}.title`)}</h3>
                <p>{t(`practice.tools.${key}.body`)}</p>
              </div>
            </Reveal>
          ))}
        </ul>
        <Reveal className="lp-band-foot">
          <div>
            <p className="lp-band-foot-label">{t('practice.soonLabel')}</p>
            <ul className="lp-hardware">
              {SOON.map((key) => (
                <li key={key}>{t(`practice.soon.${key}`)}</li>
              ))}
            </ul>
          </div>
          <Link href="/courses" className="lp-btn lp-btn-light">
            {t('practice.cta')}
            <span className="lp-btn-icon">
              <ArrowUpRight aria-hidden className="size-4" />
            </span>
          </Link>
        </Reveal>
      </div>
    </section>
  );
}
