import { type ReactNode } from 'react';

/**
 * Page header for inner pages, in the landing page's language:
 * soft lavender/peach glow, a morphing orb, kicker + display title + lede.
 */
export function PageHero({
  kicker,
  title,
  subtitle,
  children,
  aside,
  className = '',
}: {
  kicker?: string;
  title: string;
  subtitle?: string;
  /** Rendered under the copy: search, actions, stats. */
  children?: ReactNode;
  /** Optional right-hand column (e.g. an image or a card). */
  aside?: ReactNode;
  className?: string;
}) {
  return (
    <section className={`page-hero ${className}`}>
      <div className="page-hero-orb" aria-hidden />
      <div
        className={`container grid items-center gap-8 ${aside ? 'lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]' : ''}`}
      >
        <div className="flex max-w-3xl flex-col gap-4">
          {kicker ? <p className="kicker">{kicker}</p> : null}
          <h1>{title}</h1>
          {subtitle ? (
            <p className="max-w-2xl text-base leading-relaxed text-muted-foreground md:text-lg">{subtitle}</p>
          ) : null}
          {children ? <div className="mt-2">{children}</div> : null}
        </div>
        {aside}
      </div>
    </section>
  );
}
