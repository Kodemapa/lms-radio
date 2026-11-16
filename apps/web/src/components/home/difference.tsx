import { type CSSProperties } from 'react';
import { Check, Eye, Hand, Lightbulb, RefreshCw, X } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { Reveal } from './reveal';

// Each "here" claim maps to a shipped feature (docs/PROGRESS.md, docs/TODO.md INS-*).
const ROWS = ['images', 'practice', 'assessment', 'feedback', 'reasoning', 'progress'] as const;

const LOOP = [
  { key: 'see', Icon: Eye },
  { key: 'do', Icon: Hand },
  { key: 'why', Icon: Lightbulb },
  { key: 'again', Icon: RefreshCw },
] as const;

/** "Why it's different": typical LMS vs. this platform, then the understanding loop. */
export async function Difference() {
  const t = await getTranslations('Home');
  return (
    <section aria-labelledby="difference" className="lp-section lp-diff">
      <div className="container">
        <Reveal className="lp-diff-head">
          <p className="lp-kicker">{t('diff.eyebrow')}</p>
          <h2 id="difference" className="lp-title">
            {t('diff.title')} <span className="lp-diff-accent">{t('diff.titleAccent')}</span>
          </h2>
          <p className="lp-diff-lede">{t('diff.lede')}</p>
        </Reveal>

        <div className="lp-compare" role="table" aria-label={t('diff.tableLabel')}>
          <div className="lp-compare-row lp-compare-header" role="row">
            <span role="columnheader" className="lp-compare-topic" />
            <span role="columnheader" className="lp-compare-them">
              {t('diff.them')}
            </span>
            <span role="columnheader" className="lp-compare-us">
              {t('diff.us')}
            </span>
          </div>
          {ROWS.map((key, i) => (
            <Reveal key={key} delay={i * 70}>
              <div className="lp-compare-row" role="row">
                <span role="rowheader" className="lp-compare-topic">
                  {t(`diff.rows.${key}.topic`)}
                </span>
                <span role="cell" className="lp-compare-them">
                  <X aria-hidden className="size-4" />
                  <span>
                    <span className="lp-compare-tag">{t('diff.them')}</span>
                    {t(`diff.rows.${key}.them`)}
                  </span>
                </span>
                <span role="cell" className="lp-compare-us">
                  <Check aria-hidden className="size-4" />
                  <span>
                    <span className="lp-compare-tag">{t('diff.us')}</span>
                    {t(`diff.rows.${key}.us`)}
                  </span>
                </span>
              </div>
            </Reveal>
          ))}
        </div>

        <Reveal variant="scale" className="lp-loop">
          <div className="lp-loop-copy">
            <p className="lp-kicker">{t('diff.loop.eyebrow')}</p>
            <h3>{t('diff.loop.title')}</h3>
            <p>{t('diff.loop.body')}</p>
          </div>
          <ol className="lp-loop-steps">
            {LOOP.map(({ key, Icon }, i) => (
              <li key={key} style={{ '--i': i } as CSSProperties}>
                <span className="lp-loop-icon">
                  <Icon aria-hidden className="size-5" />
                </span>
                <strong>{t(`diff.loop.${key}.title`)}</strong>
                <span>{t(`diff.loop.${key}.body`)}</span>
              </li>
            ))}
          </ol>
        </Reveal>
      </div>
    </section>
  );
}
