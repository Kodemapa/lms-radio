/**
 * The site's global loader: a soft overlay with a plum-to-peach ring orbiting a pulsing
 * dot, centred in the viewport on every screen size. It fades in after a short delay so
 * fast page changes never flash it. Reduced-motion users get a still ring with the text.
 *
 * `source` lets the navigation loader hide itself while a route's own loading screen is
 * already showing, so two overlays never stack (see `.global-loader` in globals.css).
 */
export function GlobalLoader({ label, source = 'route' }: { label: string; source?: 'route' | 'nav' }) {
  return (
    <div
      role="status"
      aria-live="polite"
      data-source={source}
      className="global-loader fixed inset-0 z-[90] grid place-items-center bg-background/55 px-4 backdrop-blur-[2px]"
    >
      <div className="flex flex-col items-center gap-4 rounded-3xl border border-border bg-card/95 px-8 py-7 shadow-lg sm:px-10 sm:py-8">
        <div className="relative grid size-14 place-items-center sm:size-16" aria-hidden>
          <span className="page-loader-ring absolute inset-0 rounded-full" />
          <span className="page-loader-dot size-4 rounded-full bg-gradient-to-br from-primary to-accent sm:size-5" />
        </div>
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}
