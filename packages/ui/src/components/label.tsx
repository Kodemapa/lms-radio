import { type ComponentProps } from 'react';
import { cn } from '../lib/cn';

/**
 * Form label. `required` adds a red asterisk; screen readers skip it because
 * the field itself carries `required` / `aria-required`.
 */
export function Label({ className, required, children, ...props }: ComponentProps<'label'> & { required?: boolean }) {
  return (
    <label className={cn('text-sm font-medium leading-none', className)} {...props}>
      {children}
      {required ? (
        <span aria-hidden="true" className="ms-1 text-destructive">
          *
        </span>
      ) : null}
    </label>
  );
}
