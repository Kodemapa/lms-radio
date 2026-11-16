'use client';

import { ClipboardCheck, ClipboardList, LayoutDashboard, Library, Loader2, MessageSquareText, PlusCircle, UserCheck } from 'lucide-react';
import { useLinkStatus } from 'next/link';
import { Link, usePathname } from '@/i18n/navigation';

/** Spins on the link that was just clicked until its page arrives. */
function PendingSpinner() {
  const { pending } = useLinkStatus();
  return pending ? <Loader2 aria-hidden className="ms-auto size-4 animate-spin" /> : null;
}

const ICONS = {
  dashboard: LayoutDashboard,
  courses: Library,
  newCourse: PlusCircle,
  submissions: ClipboardList,
  reviews: MessageSquareText,
  review: ClipboardCheck,
  applications: UserCheck,
};

export function SidebarNav({
  items,
  label,
}: {
  items: { href: string; label: string; icon: keyof typeof ICONS }[];
  label: string;
}) {
  const pathname = usePathname();
  const isActive = (href: string) =>
    href === '/instructor'
      ? pathname === href
      : href === '/instructor/courses'
        ? pathname.startsWith(href) && pathname !== '/instructor/courses/new'
        : pathname.startsWith(href);

  return (
    <nav aria-label={label} className="flex gap-1 overflow-x-auto lg:flex-col">
      {items.map((item) => {
        const Icon = ICONS[item.icon];
        const active = isActive(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? 'page' : undefined}
            className={`flex items-center gap-3 whitespace-nowrap rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
              active ? 'bg-primary text-primary-foreground' : 'hover:bg-primary-light hover:text-primary'
            }`}
          >
            <Icon aria-hidden className="size-5" />
            {item.label}
            <PendingSpinner />
          </Link>
        );
      })}
    </nav>
  );
}
