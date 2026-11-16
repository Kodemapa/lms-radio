import { describe, expect, it } from 'vitest';
import { formatClock, formatDuration, priceLabels } from './format';

describe('formatDuration', () => {
  it.each([
    [30, '1m'],
    [540, '9m'],
    [3600, '1h'],
    [5040, '1h 24m'],
  ])('%i seconds → %s', (sec, label) => expect(formatDuration(sec)).toBe(label));
});

describe('formatClock', () => {
  it('pads seconds', () => expect(formatClock(605)).toBe('10:05'));
});

describe('priceLabels', () => {
  it('is null for free courses', () => {
    expect(priceLabels({ isFree: true, pricePaise: 0, discountPricePaise: null }, 'en')).toBeNull();
  });
  it('shows the discount and the struck-through original', () => {
    expect(priceLabels({ isFree: false, pricePaise: 149900, discountPricePaise: 99900 }, 'en')).toEqual({
      current: '₹999',
      original: '₹1,499',
    });
  });
  it('shows a single price without discount', () => {
    expect(priceLabels({ isFree: false, pricePaise: 99950, discountPricePaise: null }, 'en')).toEqual({
      current: '₹999.50',
      original: null,
    });
  });
});
