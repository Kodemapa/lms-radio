'use client';

import { type ReactNode } from 'react';
import { Link, usePathname } from '@/i18n/navigation';

/** Header link with the previous site's underline-on-active style. */
export function NavLink({ href, children }: { href: string; children: ReactNode }) {
  const pathname = usePathname();
  const active = href === '/' ? pathname === '/' : pathname.startsWith(href);
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={`px-2 pb-1 transition-colors hover:text-primary ${
        active ? 'border-b-2 border-primary font-semibold text-primary' : 'border-b-2 border-transparent'
      }`}
    >
      {children}
    </Link>
  );
}
