'use client';

import { type DayCount } from '@obgyn/types';
import { useLocale } from 'next-intl';
import { useEffect, useId, useRef, useState } from 'react';

const HEIGHT = 160;
const PAD = { top: 12, right: 8, bottom: 24, left: 32 };
const MAX_BAR = 24;

/** 0 → 1, 3 → 4, 17 → 20, 230 → 250: a clean axis top. */
export function niceMax(value: number): number {
  if (value <= 4) return Math.max(1, Math.ceil(value));
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const steps = [1, 2, 2.5, 5, 10];
  return steps.map((s) => s * magnitude).find((v) => v >= value) ?? 10 * magnitude;
}

/** Axis ticks: 0, the midpoint when it is a whole number, and the top. Always distinct. */
export function axisTicks(max: number): number[] {
  return max >= 2 && max % 2 === 0 ? [0, max / 2, max] : [0, max];
}

/** Column with a 4px rounded top, square at the baseline. */
function columnPath(x: number, y: number, w: number, h: number): string {
  if (h <= 0) return '';
  const r = Math.min(4, w / 2, h);
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
}

/**
 * One series of daily counts as columns (single hue, no legend: the title names
 * it). Hover or focus a day for its value; a table view carries every number.
 */
export function DayBars({ data, title, valueLabel, tableLabel }: { data: DayCount[]; title: string; valueLabel: (count: number) => string; tableLabel: string }) {
  const locale = useLocale();
  const id = useId();
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(600);
  const [active, setActive] = useState<number | null>(null);

  useEffect(() => {
    if (!box.current) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.max(240, Math.round(entry!.contentRect.width))));
    observer.observe(box.current);
    return () => observer.disconnect();
  }, []);

  const fmt = (date: string) => new Date(`${date}T00:00:00`).toLocaleDateString(locale, { day: 'numeric', month: 'short' });
  const max = niceMax(Math.max(0, ...data.map((d) => d.count)));
  const plotW = width - PAD.left - PAD.right;
  const plotH = HEIGHT - PAD.top - PAD.bottom;
  const band = plotW / Math.max(1, data.length);
  // Thin marks: at most 24px, always at least a 2px surface gap between neighbours.
  const barW = Math.max(1, Math.min(MAX_BAR, band - 2, band * 0.7));
  const y = (v: number) => PAD.top + plotH - (v / max) * plotH;
  const ticks = axisTicks(max);
  const total = data.reduce((s, d) => s + d.count, 0);
  const peak = data.reduce((a, d) => (d.count > a.count ? d : a), data[0] ?? { date: '', count: 0 });
  const labelIdx = [0, Math.floor((data.length - 1) / 2), data.length - 1];

  return (
    <figure className="flex flex-col gap-2">
      <figcaption className="text-sm font-medium">{title}</figcaption>
      <div ref={box} className="relative">
        <svg
          width={width}
          height={HEIGHT}
          role="img"
          aria-labelledby={`${id}-sum`}
          className="block max-w-full"
          onMouseLeave={() => setActive(null)}
        >
          <title id={`${id}-sum`}>{`${title}: ${valueLabel(total)}${peak.count ? `, peak ${peak.count} on ${fmt(peak.date)}` : ''}`}</title>
          {ticks.map((tick) => (
            <g key={tick}>
              <line x1={PAD.left} x2={width - PAD.right} y1={y(tick)} y2={y(tick)} stroke="var(--border)" strokeWidth={1} />
              <text x={PAD.left - 6} y={y(tick)} dy="0.32em" textAnchor="end" className="fill-muted-foreground text-[11px]">
                {tick.toLocaleString(locale)}
              </text>
            </g>
          ))}
          {data.map((d, i) => {
            const x = PAD.left + i * band + (band - barW) / 2;
            const h = (d.count / max) * plotH;
            return (
              <g key={d.date}>
                <path d={columnPath(x, y(d.count), barW, h)} fill="var(--chart-1)" opacity={active === null || active === i ? 1 : 0.55} />
                {/* The whole band is the hit target, bigger than the mark. */}
                <rect
                  x={PAD.left + i * band}
                  y={PAD.top}
                  width={band}
                  height={plotH}
                  fill="transparent"
                  tabIndex={0}
                  aria-label={`${fmt(d.date)}: ${valueLabel(d.count)}`}
                  onMouseEnter={() => setActive(i)}
                  onFocus={() => setActive(i)}
                  onBlur={() => setActive(null)}
                  className="outline-none focus-visible:stroke-[var(--ring)] focus-visible:stroke-2"
                />
              </g>
            );
          })}
          {labelIdx.map((i) =>
            data[i] ? (
              <text key={i} x={PAD.left + i * band + band / 2} y={HEIGHT - 6} textAnchor={i === 0 ? 'start' : i === data.length - 1 ? 'end' : 'middle'} className="fill-muted-foreground text-[11px]">
                {fmt(data[i]!.date)}
              </text>
            ) : null,
          )}
        </svg>
        {active !== null && data[active] ? (
          <div
            role="status"
            className="pointer-events-none absolute z-10 whitespace-nowrap rounded-md border border-border bg-card px-2 py-1 text-xs shadow"
            style={{
              // Keep the tooltip inside the chart near either edge.
              left: Math.min(Math.max(PAD.left + active * band + band / 2 - 60, 0), width - 120),
              top: Math.max(0, y(data[active]!.count) - 44),
              width: 120,
            }}
          >
            <span className="block text-muted-foreground">{fmt(data[active]!.date)}</span>
            <span className="font-semibold">{valueLabel(data[active]!.count)}</span>
          </div>
        ) : null}
      </div>
      <details className="text-xs text-muted-foreground">
        <summary className="cursor-pointer">{tableLabel}</summary>
        <table className="mt-2 w-full max-w-sm text-left">
          <tbody>
            {data.map((d) => (
              <tr key={d.date} className="border-t border-border">
                <th scope="row" className="py-1 font-normal">{fmt(d.date)}</th>
                <td className="py-1 text-end tabular-nums text-foreground">{d.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}

/** A completion meter: the fill on a lighter track of the same hue, with the number beside it. */
export function Meter({ percent, label }: { percent: number; label: string }) {
  const value = Math.max(0, Math.min(100, percent));
  return (
    <span className="flex items-center gap-2">
      <span role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={value} aria-label={label} className="h-2 w-28 shrink-0 overflow-hidden rounded-full bg-[var(--chart-track)]">
        <span className="block h-full rounded-full bg-[var(--chart-1)]" style={{ width: `${value}%` }} />
      </span>
      <span className="tabular-nums text-xs text-muted-foreground">{value}%</span>
    </span>
  );
}
