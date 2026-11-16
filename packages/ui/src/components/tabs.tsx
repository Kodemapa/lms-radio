'use client';

import * as TabsPrimitive from '@radix-ui/react-tabs';
import { type ComponentProps } from 'react';
import { cn } from '../lib/cn';

export const Tabs = TabsPrimitive.Root;

export function TabsList({ className, ...props }: ComponentProps<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      className={cn('flex w-full gap-1 overflow-x-auto rounded-full bg-muted p-1 [scrollbar-width:none]', className)}
      {...props}
    />
  );
}

export function TabsTrigger({ className, ...props }: ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      className={cn(
        'whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold text-muted-foreground transition-[background-color,color,box-shadow] hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-sm',
        className,
      )}
      {...props}
    />
  );
}

export function TabsContent({ className, ...props }: ComponentProps<typeof TabsPrimitive.Content>) {
  return <TabsPrimitive.Content className={cn('pt-6 focus-visible:outline-none', className)} {...props} />;
}
