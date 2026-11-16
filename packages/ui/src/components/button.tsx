import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { type ComponentProps } from 'react';
import { cn } from '../lib/cn';

export const buttonVariants = cva(
  'inline-flex cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-full text-sm font-semibold transition-[background-color,border-color,color,box-shadow,transform] duration-200 active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default:
          'bg-primary text-primary-foreground shadow-[0_10px_22px_-12px_var(--primary)] hover:-translate-y-px hover:bg-primary-hover',
        secondary:
          'bg-secondary text-secondary-foreground shadow-[0_10px_22px_-12px_var(--secondary)] hover:-translate-y-px hover:opacity-95',
        outline: 'border border-border bg-card hover:border-primary/40 hover:bg-primary-light',
        ghost: 'hover:bg-primary-light hover:text-primary',
        destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
      },
      size: {
        default: 'h-11 px-5 py-2',
        sm: 'h-9 px-4',
        lg: 'h-12 px-7 text-base',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
);

export interface ButtonProps extends ComponentProps<'button'>, VariantProps<typeof buttonVariants> {
  /** Render the child element (e.g. a link) with button styling. */
  asChild?: boolean;
}

export function Button({ className, variant, size, asChild = false, ...props }: ButtonProps) {
  const Comp = asChild ? Slot : 'button';
  return <Comp className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}
