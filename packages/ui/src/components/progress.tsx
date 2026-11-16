import { type ComponentProps } from 'react';
import { cn } from '../lib/cn';

export function Progress({ value, className, ...props }: ComponentProps<'div'> & { value: number }) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(clamped)}
      className={cn('h-2 w-full overflow-hidden rounded-full bg-muted', className)}
      {...props}
    >
      <div className="h-full rounded-full bg-gradient-to-r from-primary to-accent transition-[width]" style={{ width: `${clamped}%` }} />
    </div>
  );
}
