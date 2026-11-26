'use client';

import { type ReactNode } from 'react';
import { usePathname } from '@/i18n/navigation';

/**
 * Account pages: profile and security show the account card + menu beside them;
 * My learning and Wishlist (reached from the header menu) use the full width.
 */
export function AccountFrame({ sidebar, children }: { sidebar: ReactNode; children: ReactNode }) {
  const pathname = usePathname();
  const withSidebar = pathname.startsWith('/account/profile') || pathname.startsWith('/account/security');
  return (
    <div
      className={`container grid grid-cols-[minmax(0,1fr)] gap-6 py-8 lg:py-12 ${withSidebar ? 'lg:grid-cols-[270px_minmax(0,1fr)]' : ''}`}
    >
      {withSidebar ? sidebar : null}
      <div className="min-w-0">{children}</div>
    </div>
  );
}
