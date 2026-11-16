'use client';

import { BarChart3, CheckCircle2, PlayCircle, Ruler, XCircle } from 'lucide-react';
import Image, { type StaticImageData } from 'next/image';
import { useEffect, useRef, useState } from 'react';

/** What the pinned media frame shows for a step. */
export type JourneyVisual =
  | { type: 'photo'; src: StaticImageData; alt: string; calipers?: boolean }
  | {
      type: 'result';
      src: StaticImageData;
      title: string;
      rows: { label: string; verdict: string; ok: boolean }[];
      footer: string;
      note: string;
    }
  | {
      type: 'report';
      title: string;
      badge: string;
      rows: { label: string; status: string; value: number; tone: 'strong' | 'mid' | 'weak' }[];
      note: string;
    };

export type JourneyStep = { key: string; title: string; body: string; visual: JourneyVisual };

const ICONS = [PlayCircle, Ruler, CheckCircle2, BarChart3];

/**
 * Scroll-told section: steps scroll past on the right while the media
 * frame on the left stays pinned and cross-fades to the active step.
 * On small screens each step shows its own media inline.
 */
export function LearningJourney({ steps }: { steps: JourneyStep[] }) {
  const [active, setActive] = useState(0);
  const refs = useRef<(HTMLElement | null)[]>([]);

  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActive(Number((entry.target as HTMLElement).dataset.step));
        }
      },
      { rootMargin: '-45% 0px -45% 0px' },
    );
    refs.current.forEach((el) => el && io.observe(el));
    return () => io.disconnect();
  }, []);

  return (
    <div className="lp-journey">
      <div className="lp-journey-stage" aria-hidden>
        {steps.map((step, i) => (
          <div key={step.key} className="lp-journey-layer" data-active={i === active}>
            <Visual visual={step.visual} />
          </div>
        ))}
        <ol className="lp-journey-dots">
          {steps.map((step, i) => (
            <li key={step.key} data-active={i === active} />
          ))}
        </ol>
      </div>
      <ol className="lp-journey-steps">
        {steps.map((step, i) => {
          const Icon = ICONS[i % ICONS.length]!;
          return (
            <li
              key={step.key}
              data-step={i}
              data-active={i === active}
              ref={(el) => {
                refs.current[i] = el;
              }}
              className="lp-journey-step"
            >
              <div className="lp-journey-inline">
                <Visual visual={step.visual} />
              </div>
              <span className="lp-journey-num">
                <Icon aria-hidden className="size-5" />
                <span>0{i + 1}</span>
              </span>
              <h3>{step.title}</h3>
              <p>{step.body}</p>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function Calipers() {
  return (
    <svg
      viewBox="0 0 560 452"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden
      className="lp-caliper lp-caliper-lg"
    >
      <ellipse cx="394" cy="146" rx="60" ry="66" transform="rotate(-12 394 146)" />
      <path d="M336 158 452 134" />
    </svg>
  );
}

function Visual({ visual }: { visual: JourneyVisual }) {
  if (visual.type === 'photo') {
    return (
      <div className="lp-journey-photo">
        <Image
          src={visual.src}
          alt={visual.alt}
          placeholder="blur"
          sizes="(min-width: 1024px) 620px, 90vw"
        />
        {visual.calipers && <Calipers />}
      </div>
    );
  }

  if (visual.type === 'result') {
    return (
      <div className="lp-journey-photo lp-result" role="img" aria-label={visual.note}>
        <Image src={visual.src} alt="" placeholder="blur" sizes="(min-width: 1024px) 620px, 90vw" />
        <Calipers />
        <div className="lp-result-card">
          <p className="lp-result-title">{visual.title}</p>
          <ul>
            {visual.rows.map((row) => (
              <li key={row.label} data-ok={row.ok}>
                {row.ok ? (
                  <CheckCircle2 aria-hidden className="size-4" />
                ) : (
                  <XCircle aria-hidden className="size-4" />
                )}
                <span>{row.label}</span>
                <em>{row.verdict}</em>
              </li>
            ))}
          </ul>
          <p className="lp-result-foot">{visual.footer}</p>
        </div>
        <p className="lp-mock-note">{visual.note}</p>
      </div>
    );
  }

  return (
    <div className="lp-week" role="img" aria-label={visual.note}>
      <div className="lp-week-head">
        <p>{visual.title}</p>
        <span>{visual.badge}</span>
      </div>
      <div className="lp-week-arc" />
      <ul>
        {visual.rows.map((row) => (
          <li key={row.label}>
            <span>{row.label}</span>
            <span className="lp-week-bar">
              <span style={{ width: `${row.value}%` }} />
            </span>
            <em data-tone={row.tone}>{row.status}</em>
          </li>
        ))}
      </ul>
      <p className="lp-week-note">{visual.note}</p>
    </div>
  );
}
