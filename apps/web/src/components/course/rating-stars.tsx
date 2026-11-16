import { Star } from 'lucide-react';

/** Read-only stars, e.g. 4.3 → ★★★★☆ with a partial fill. */
export function RatingStars({ value, size = 'size-4' }: { value: number; size?: string }) {
  return (
    <span className="flex items-center" aria-hidden>
      {[0, 1, 2, 3, 4].map((i) => {
        const fill = Math.max(0, Math.min(1, value - i));
        return (
          <span key={i} className={`relative ${size}`}>
            <Star className={`absolute inset-0 ${size} text-rating`} />
            <span className="absolute inset-0 overflow-hidden" style={{ width: `${fill * 100}%` }}>
              <Star className={`${size} fill-rating text-rating`} />
            </span>
          </span>
        );
      })}
    </span>
  );
}
