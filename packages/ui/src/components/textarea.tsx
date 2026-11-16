import { type ComponentProps } from 'react';
import { cn } from '../lib/cn';

export function Textarea({ className, ...props }: ComponentProps<'textarea'>) {
  return (
    <textarea
      className={cn(
        'flex min-h-24 w-full rounded-xl border border-border bg-card px-4 py-3 text-base transition-[border-color,box-shadow] placeholder:text-muted-foreground focus-visible:outline-none focus-visible:border-primary focus-visible:ring-4 focus-visible:ring-primary/15 disabled:cursor-not-allowed disabled:opacity-50 aria-[invalid=true]:border-destructive',
        className,
      )}
      {...props}
    />
  );
}
