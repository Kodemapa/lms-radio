import { type Price } from '@obgyn/types';
import { priceLabels } from '@/lib/format';

export function PriceTag({
  price,
  locale,
  freeLabel,
  size = 'md',
}: {
  price: Price;
  locale: string;
  freeLabel: string;
  size?: 'md' | 'lg';
}) {
  const labels = priceLabels(price, locale);
  const big = size === 'lg' ? 'text-3xl' : 'text-xl md:text-2xl';
  if (!labels) return <span className={`${big} font-semibold text-success`}>{freeLabel}</span>;
  return (
    <span className="flex flex-wrap items-baseline gap-2">
      <span className={`${big} font-semibold`}>{labels.current}</span>
      {labels.original ? (
        <s className="text-muted-foreground">
          {labels.original}
        </s>
      ) : null}
    </span>
  );
}
