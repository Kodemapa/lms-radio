import { ArrowUpRight, Check } from 'lucide-react';
import Image from 'next/image';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import cohort from './images/training-cohort.webp';
import { Reveal } from './reveal';

// Faculty tools that exist today (docs/TODO.md INS-1…INS-9, imaging case editor).
const FACULTY = ['cases', 'bank', 'reports', 'team'] as const;

export async function InstructorCommunity() {
  const t = await getTranslations('Home');
  return (
    <section aria-labelledby="community" className="lp-section">
      <div className="container">
        <Reveal variant="scale" className="lp-cta">
          <div className="lp-cta-copy">
            <p className="lp-kicker">{t('communityEyebrow')}</p>
            <h2 id="community" className="lp-title">
              {t('communityTitle')}
            </h2>
            <p>{t('communityBody')}</p>
            <ul className="lp-cta-list">
              {FACULTY.map((key) => (
                <li key={key}>
                  <Check aria-hidden className="size-4" />
                  {t(`faculty.${key}`)}
                </li>
              ))}
            </ul>
            <Link href="/become-instructor" className="lp-btn lp-btn-primary">
              {t('communityCta')}
              <span className="lp-btn-icon">
                <ArrowUpRight aria-hidden className="size-4" />
              </span>
            </Link>
          </div>
          <div className="lp-cta-photo">
            <Image
              src={cohort}
              alt={t('img.cohort')}
              placeholder="blur"
              sizes="(min-width: 768px) 50vw, 100vw"
            />
          </div>
        </Reveal>
      </div>
    </section>
  );
}
