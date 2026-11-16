import { ChevronDown } from 'lucide-react';
import { type ComponentProps } from 'react';
import { cn } from '../lib/cn';

/** Native select styled to match Input: accessible and mobile-friendly. */
export function Select({ className, children, ...props }: ComponentProps<'select'>) {
  return (
    <div className="relative">
      <select
        className={cn(
          'flex h-11 w-full appearance-none rounded-xl border border-border bg-card py-2 pl-4 pr-10 text-base transition-[border-color,box-shadow] focus-visible:outline-none focus-visible:border-primary focus-visible:ring-4 focus-visible:ring-primary/15 disabled:cursor-not-allowed disabled:opacity-50 aria-[invalid=true]:border-destructive',
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        aria-hidden
        className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
      />
    </div>
  );
}
