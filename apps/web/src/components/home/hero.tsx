import { type CSSProperties } from 'react';
import { ArrowRight, ArrowUpRight, Check, GraduationCap, Sparkles } from 'lucide-react';
import Image from 'next/image';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import abdominalScan from './images/abdominal-scan.webp';
import fetal3d from './images/fetal-3d-render.webp';
import profileScan from './images/fetal-profile-scan.webp';

export async function Hero({
  stats,
}: {
  stats: { courses: number; instructors: number; students: number };
}) {
  const t = await getTranslations('Home');
  const statItems = [
    { value: stats.courses, label: t('statCourses') },
    { value: stats.instructors, label: t('statInstructors') },
    { value: stats.students, label: t('statStudents') },
  ].filter((s) => s.value > 0);

  return (
    <section className="lp-hero" aria-labelledby="hero-title">
      <div className="lp-hero-glow" aria-hidden />
      <div className="container lp-hero-grid">
        <div className="lp-hero-copy">
          <p className="lp-pill lp-enter" style={{ '--i': 0 } as CSSProperties}>
            <Sparkles aria-hidden className="size-3.5" />
            {t('eyebrow')}
          </p>
          <h1 id="hero-title" className="lp-enter" style={{ '--i': 1 } as CSSProperties}>
            <span className="lp-heading-line">{t('title')}</span>
            <span className="lp-heading-line lp-highlight">
              {t('titleAccent')}
              <svg viewBox="0 0 300 18" preserveAspectRatio="none" aria-hidden>
                <path d="M3 13C60 4 130 2 297 9" />
              </svg>
            </span>
          </h1>
          <p className="lp-hero-intro lp-enter" style={{ '--i': 2 } as CSSProperties}>
            {t('subtitle')}
          </p>
          <div className="lp-hero-ctas lp-enter" style={{ '--i': 3 } as CSSProperties}>
            <Link href="/courses" className="lp-btn lp-btn-primary">
              {t('ctaCourses')}
              <span className="lp-btn-icon">
                <ArrowUpRight aria-hidden className="size-4" />
              </span>
            </Link>
            <Link href="#learning-approach" className="lp-btn lp-btn-ghost">
              {t('ctaApproach')}
              <ArrowRight aria-hidden className="size-4" />
            </Link>
          </div>
          <div className="lp-audience lp-enter" style={{ '--i': 4 } as CSSProperties}>
            <span className="lp-audience-icon">
              <GraduationCap aria-hidden className="size-5" />
            </span>
            <p>{t('audience')}</p>
          </div>
          {statItems.length > 0 && (
            <dl className="lp-stats lp-enter" style={{ '--i': 5 } as CSSProperties}>
              {statItems.map((s) => (
                <div key={s.label}>
                  <dt>{s.label}</dt>
                  <dd>{s.value.toLocaleString()}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>

        <div className="lp-hero-art">
          <div className="lp-blob" aria-hidden />
          <div className="lp-ring" aria-hidden />
          <figure className="lp-arch">
            <Image
              src={abdominalScan}
              alt={t('img.scanning')}
              placeholder="blur"
              priority
              sizes="(min-width: 1024px) 420px, 80vw"
            />
          </figure>

          <div className="lp-scan-card lp-float" style={{ '--d': '0s' } as CSSProperties}>
            <div className="lp-scan-head">
              <span>{t('previewLabel')}</span>
              <span className="lp-live">
                <span className="lp-pulse" aria-hidden />
                {t('previewBadge')}
              </span>
            </div>
            <div className="lp-scan-img">
              <Image
                src={profileScan}
                alt={t('img.profile')}
                placeholder="blur"
                sizes="300px"
              />
              <svg
                viewBox="0 0 560 452"
                preserveAspectRatio="xMidYMid slice"
                aria-hidden
                className="lp-caliper"
              >
                <ellipse cx="394" cy="146" rx="60" ry="66" transform="rotate(-12 394 146)" />
                <path d="M336 158 452 134" />
              </svg>
            </div>
            <p className="lp-scan-title">{t('previewCase')}</p>
            <p className="lp-scan-sub">
              <span>
                <Check aria-hidden className="size-3" />
              </span>
              {t('feedbackBody')}
            </p>
          </div>

          <figure className="lp-bubble lp-float" style={{ '--d': '-2s' } as CSSProperties}>
            <Image src={fetal3d} alt={t('img.render3d')} placeholder="blur" sizes="140px" />
          </figure>

          <p className="lp-chip lp-chip-a lp-float" style={{ '--d': '-4s' } as CSSProperties}>
            <span className="lp-chip-dot" aria-hidden />
            {t('heroChipGraded')}
          </p>
          <p className="lp-chip lp-chip-b lp-float" style={{ '--d': '-1s' } as CSSProperties}>
            {t('heroChipTopic')}
          </p>
        </div>
      </div>
    </section>
  );
}
