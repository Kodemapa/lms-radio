import { getTranslations } from 'next-intl/server';

const TOPICS = ['t1', 't2', 't3', 't4', 't5', 't6', 't7', 't8'] as const;

/** Endless, gently scrolling ribbon of course topics. Pauses on hover. */
export async function TopicMarquee() {
  const t = await getTranslations('Home');
  const items = TOPICS.map((k) => t(`topics.${k}`));
  return (
    <section className="lp-marquee" aria-label={t('topicsLabel')}>
      <div className="lp-marquee-track">
        <ul>
          {items.map((label) => (
            <li key={label}>
              <span aria-hidden>✦</span>
              {label}
            </li>
          ))}
        </ul>
        {/* Duplicate list makes the loop seamless; hidden from assistive tech. */}
        <ul aria-hidden>
          {items.map((label) => (
            <li key={label}>
              <span>✦</span>
              {label}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
