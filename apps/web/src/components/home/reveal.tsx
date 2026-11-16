'use client';

import { type CSSProperties, type ReactNode, useEffect, useRef } from 'react';

type Variant = 'up' | 'left' | 'right' | 'scale';

/**
 * Fades/slides its content in the first time it scrolls into view.
 * Hidden state lives in CSS under `(scripting: enabled)` and
 * `(prefers-reduced-motion: no-preference)`, so content is never lost
 * without JS or for users who opt out of motion.
 */
export function Reveal({
  as: Tag = 'div',
  variant = 'up',
  delay = 0,
  className = '',
  children,
}: {
  as?: 'div' | 'li' | 'span' | 'figure';
  variant?: Variant;
  delay?: number;
  className?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === 'undefined') {
      el.dataset.shown = 'true';
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            (entry.target as HTMLElement).dataset.shown = 'true';
            io.unobserve(entry.target);
          }
        }
      },
      { rootMargin: '0px 0px -10% 0px', threshold: 0.12 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <Tag
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- polymorphic ref
      ref={ref as any}
      data-reveal={variant}
      className={className}
      style={{ '--reveal-delay': `${delay}ms` } as CSSProperties}
    >
      {children}
    </Tag>
  );
}
