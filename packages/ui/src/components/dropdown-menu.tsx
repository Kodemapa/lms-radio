'use client';

import * as DropdownPrimitive from '@radix-ui/react-dropdown-menu';
import { type ComponentProps } from 'react';
import { cn } from '../lib/cn';

export const DropdownMenu = DropdownPrimitive.Root;
export const DropdownMenuTrigger = DropdownPrimitive.Trigger;
export const DropdownMenuGroup = DropdownPrimitive.Group;
export const DropdownMenuSub = DropdownPrimitive.Sub;

export function DropdownMenuContent({
  className,
  sideOffset = 8,
  ...props
}: ComponentProps<typeof DropdownPrimitive.Content>) {
  return (
    <DropdownPrimitive.Portal>
      <DropdownPrimitive.Content
        sideOffset={sideOffset}
        className={cn(
          'z-50 min-w-[12rem] overflow-hidden rounded-xl border border-border bg-card p-1.5 text-card-foreground shadow-lg',
          className,
        )}
        {...props}
      />
    </DropdownPrimitive.Portal>
  );
}

export function DropdownMenuItem({ className, ...props }: ComponentProps<typeof DropdownPrimitive.Item>) {
  return (
    <DropdownPrimitive.Item
      className={cn(
        'flex cursor-pointer select-none items-center gap-2 rounded-lg px-3 py-2 text-sm outline-none transition-colors data-[highlighted]:bg-primary/10 data-[highlighted]:text-primary',
        className,
      )}
      {...props}
    />
  );
}

export function DropdownMenuSubTrigger({ className, ...props }: ComponentProps<typeof DropdownPrimitive.SubTrigger>) {
  return (
    <DropdownPrimitive.SubTrigger
      className={cn(
        'flex cursor-pointer select-none items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm outline-none data-[highlighted]:bg-primary/10 data-[state=open]:bg-primary/10',
        className,
      )}
      {...props}
    />
  );
}

export function DropdownMenuSubContent({ className, ...props }: ComponentProps<typeof DropdownPrimitive.SubContent>) {
  return (
    <DropdownPrimitive.Portal>
      <DropdownPrimitive.SubContent
        className={cn('z-50 min-w-[12rem] rounded-2xl border border-border/70 bg-card p-1.5 shadow-lg', className)}
        {...props}
      />
    </DropdownPrimitive.Portal>
  );
}

export function DropdownMenuLabel({ className, ...props }: ComponentProps<typeof DropdownPrimitive.Label>) {
  return <DropdownPrimitive.Label className={cn('px-3 py-2 text-sm font-semibold', className)} {...props} />;
}

export function DropdownMenuSeparator({ className, ...props }: ComponentProps<typeof DropdownPrimitive.Separator>) {
  return <DropdownPrimitive.Separator className={cn('-mx-1.5 my-1.5 h-px bg-border', className)} {...props} />;
}
