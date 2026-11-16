'use client';

import { BookOpen, Bookmark, ShieldCheck, UserRound } from 'lucide-react';
import { Link, usePathname } from '@/i18n/navigation';

const ICONS = { learning: BookOpen, wishlist: Bookmark, profile: UserRound, security: ShieldCheck };

export function AccountNav({ items, label }: { items: { key: keyof typeof ICONS; label: string }[]; label: string }) {
  const pathname = usePathname();
  return (
    <nav aria-label={label} className="flex gap-1 overflow-x-auto lg:flex-col">
      {items.map(({ key, label: text }) => {
        const href = `/account/${key}`;
        const Icon = ICONS[key];
        const active = pathname.startsWith(href);
        return (
          <Link
            key={key}
            href={href}
            aria-current={active ? 'page' : undefined}
            className={`flex items-center gap-3 whitespace-nowrap rounded-lg px-3 py-2.5 text-sm font-medium ${
              active ? 'bg-primary text-primary-foreground' : 'hover:bg-primary-light hover:text-primary'
            }`}
          >
            <Icon aria-hidden className="size-5" />
            {text}
          </Link>
        );
      })}
    </nav>
  );
}
