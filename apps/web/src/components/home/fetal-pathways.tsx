import { ArrowUpRight, AudioLines, Focus, Ruler, ScanLine } from 'lucide-react';
import Image from 'next/image';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import anomalyViews from './images/anomaly-views.webp';
import dopplerExam from './images/doppler-exam.webp';
import firstTrimester from './images/first-trimester.webp';
import scanner from './images/ultrasound-scanner.webp';
import { Reveal } from './reveal';

const PATHWAYS = [
  { key: 'foundations', Icon: ScanLine, query: 'ultrasound', img: scanner },
  { key: 'anatomy', Icon: Focus, query: 'anomaly', img: anomalyViews },
  { key: 'biometry', Icon: Ruler, query: 'biometry', img: firstTrimester },
  { key: 'doppler', Icon: AudioLines, query: 'Doppler', img: dopplerExam },
] as const;

export async function FetalPathways() {
  const t = await getTranslations('Home');
  return (
    <section className="lp-section" aria-labelledby="pathways">
      <div className="container">
        <Reveal className="lp-section-top">
          <div>
            <p className="lp-kicker">{t('pathwayEyebrow')}</p>
            <h2 id="pathways" className="lp-title">
              {t('topCategories')}
            </h2>
          </div>
          <p className="lp-lede">{t('topCategoriesSubtitle')}</p>
        </Reveal>
        <ul className="lp-pathways">
          {PATHWAYS.map(({ key, Icon, query, img }, i) => (
            <Reveal as="li" key={key} delay={i * 90}>
              <Link
                href={`/courses?q=${encodeURIComponent(query)}`}
                className={`lp-pathway lp-tone-${i}`}
              >
                <div className="lp-pathway-media">
                  <Image
                    src={img}
                    alt=""
                    placeholder="blur"
                    sizes="(min-width: 1024px) 290px, (min-width: 640px) 45vw, 90vw"
                  />
                </div>
                <div className="lp-pathway-body">
                  <span className="lp-pathway-icon">
                    <Icon aria-hidden className="size-5" />
                  </span>
                  <span className="lp-pathway-num" aria-hidden>
                    0{i + 1}
                  </span>
                  <h3>{t(`pathways.${key}.title`)}</h3>
                  <p>{t(`pathways.${key}.body`)}</p>
                  <span className="lp-pathway-cta">
                    {t('exploreTopic')}
                    <span>
                      <ArrowUpRight aria-hidden className="size-4" />
                    </span>
                  </span>
                </div>
              </Link>
            </Reveal>
          ))}
        </ul>
      </div>
    </section>
  );
}
