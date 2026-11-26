/**
 * The site's global loader: eight isometric cubes drop in one by one and assemble into a
 * 2×2×2 block ("solving" the cube), the finished block pops, fades, and the loop starts
 * again. It sits in the middle of the viewport on every screen size, over a soft
 * backdrop, and fades in after a short delay so fast page changes never flash it.
 * Reduced-motion users see the finished block, still, with the text.
 *
 * Performance: the loader is on screen exactly while the page is busy loading, so it must
 * not compete with that work. Each cube is a static SVG inside its own HTML wrapper, and
 * only the wrappers' `transform` / `opacity` animate. Browsers run those animations on the
 * compositor (GPU) with no per-frame style, layout or paint on the main thread. (Animating
 * the SVG `<g>` elements directly, as a first version did, cannot be composited and
 * repainted the loader, plus a full-screen backdrop blur, on every frame.)
 *
 * Pure HTML + SVG + CSS (see `.cube-loader` in globals.css): it animates in the
 * server-rendered HTML before any JavaScript loads.
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
      className="global-loader fixed inset-0 z-[90] grid place-items-center bg-background/85 px-4"
    >
      <div className="flex flex-col items-center gap-5">
        <CubeLoader className="size-24 sm:size-28" />
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

/** Cube edge length and its isometric projection (in SVG user units). */
const EDGE = 22;
const HALF_W = +(EDGE * Math.cos(Math.PI / 6)).toFixed(2); // 19.05
const HALF_H = EDGE / 2;
const VIEW_BOX = '-42 -26 84 96';

/**
 * Cubes in painter's order (back to front: by i + j + k), each with the step at which it
 * drops in. Grid axes: i runs down-right, j down-left, k up.
 */
const CUBES: ReadonlyArray<{ i: number; j: number; k: number; step: number }> = [
  { i: 0, j: 0, k: 0, step: 1 },
  { i: 1, j: 0, k: 0, step: 2 },
  { i: 0, j: 1, k: 0, step: 3 },
  { i: 0, j: 0, k: 1, step: 5 },
  { i: 1, j: 1, k: 0, step: 4 },
  { i: 1, j: 0, k: 1, step: 6 },
  { i: 0, j: 1, k: 1, step: 7 },
  { i: 1, j: 1, k: 1, step: 8 },
];

const TOP = `M0 0L${HALF_W} ${HALF_H}L0 ${2 * HALF_H}L${-HALF_W} ${HALF_H}Z`;
const LEFT = `M${-HALF_W} ${HALF_H}L0 ${2 * HALF_H}L0 ${2 * HALF_H + EDGE}L${-HALF_W} ${HALF_H + EDGE}Z`;
const RIGHT = `M${HALF_W} ${HALF_H}L0 ${2 * HALF_H}L0 ${2 * HALF_H + EDGE}L${HALF_W} ${HALF_H + EDGE}Z`;

/** The cube-solving animation on its own (decorative: the caller supplies the text). */
export function CubeLoader({ className }: { className?: string }) {
  return (
    <div aria-hidden className={`cube-loader relative ${className ?? ''}`}>
      <div className="cube-loader-block absolute inset-0">
        {CUBES.map(({ i, j, k, step }) => (
          <span key={step} className={`cube-loader-cube cube-loader-step-${step} absolute inset-0 block`}>
            <svg viewBox={VIEW_BOX} overflow="visible" focusable="false" className="block size-full">
              <g transform={`translate(${((i - j) * HALF_W).toFixed(2)} ${(i + j) * HALF_H - k * EDGE})`}>
                <path d={LEFT} className="cube-loader-left" />
                <path d={RIGHT} className="cube-loader-right" />
                <path d={TOP} className={step === 8 ? 'cube-loader-top-last' : 'cube-loader-top'} />
              </g>
            </svg>
          </span>
        ))}
      </div>
    </div>
  );
}
