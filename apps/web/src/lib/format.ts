import { effectivePricePaise, formatInr, type Price } from '@obgyn/types';

export { formatInr };

/** "1h 24m" / "42m". */
export function formatDuration(totalSec: number): string {
  const hours = Math.floor(totalSec / 3600);
  const minutes = Math.round((totalSec % 3600) / 60);
  if (hours === 0) return `${Math.max(minutes, 1)}m`;
  return minutes === 0 ? `${hours}h` : `${hours}h ${minutes}m`;
}

/** mm:ss for a single lesson. */
export function formatClock(totalSec: number): string {
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function priceLabels(price: Price, locale: string): { current: string; original: string | null } | null {
  if (price.isFree) return null;
  const current = effectivePricePaise(price);
  return {
    current: formatInr(current, locale === 'hi' ? 'hi-IN' : 'en-IN'),
    original:
      current < price.pricePaise ? formatInr(price.pricePaise, locale === 'hi' ? 'hi-IN' : 'en-IN') : null,
  };
}
