'use client';

import { type CategoryNode } from '@obgyn/types';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@obgyn/ui';
import { ChevronDown, ChevronRight, LayoutGrid } from 'lucide-react';
import { useRouter } from '@/i18n/navigation';

export function CategoriesMenu({
  categories,
  label,
  allLabel,
}: {
  categories: CategoryNode[];
  label: string;
  allLabel: string;
}) {
  const router = useRouter();
  const go = (slug?: string) => router.push(slug ? `/courses?category=${slug}` : '/courses');

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex h-12 w-full items-center justify-between gap-2 rounded-[4px] bg-primary px-4 font-medium text-primary-foreground transition-colors hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
        <span className="flex items-center gap-2">
          <LayoutGrid aria-hidden className="size-5" />
          {label}
        </span>
        <ChevronDown aria-hidden className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        {categories.map((category) =>
          category.children.length > 0 ? (
            <DropdownMenuSub key={category.id}>
              <DropdownMenuSubTrigger>
                {category.name}
                <ChevronRight aria-hidden className="size-4" />
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                <DropdownMenuItem onSelect={() => go(category.slug)} className="font-medium">
                  {allLabel}: {category.name}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {category.children.map((child) => (
                  <DropdownMenuItem key={child.id} onSelect={() => go(child.slug)}>
                    {child.name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          ) : (
            <DropdownMenuItem key={category.id} onSelect={() => go(category.slug)}>
              {category.name}
            </DropdownMenuItem>
          ),
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => go()} className="font-medium text-primary">
          {allLabel}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
