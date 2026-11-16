'use client';

import { type ReactNode } from 'react';
import { Link, usePathname } from '@/i18n/navigation';

/** Header link; the active page gets a soft lavender pill. */
export function NavLink({ href, children }: { href: string; children: ReactNode }) {
  const pathname = usePathname();
  const active = href === '/' ? pathname === '/' : pathname.startsWith(href);
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={`rounded-full px-3.5 py-2 text-sm transition-colors hover:text-primary ${
        active ? 'bg-primary-light font-semibold text-primary' : 'font-medium'
      }`}
    >
      {children}
    </Link>
  );
}
