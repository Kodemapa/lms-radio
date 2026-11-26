'use client';

import {
  CircleHelp,
  ClipboardCheck,
  ClipboardList,
  Download,
  FileText,
  Film,
  Flag,
  FolderTree,
  Inbox,
  Languages,
  LayoutDashboard,
  ListChecks,
  Library,
  Loader2,
  MessageSquareText,
  PlusCircle,
  ScrollText,
  Settings,
  ShieldCheck,
  UserCheck,
  Users,
} from 'lucide-react';
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
  admin: ShieldCheck,
  users: Users,
  categories: FolderTree,
  audit: ScrollText,
  moderation: Flag,
  media: Film,
  exports: Download,
  formFields: ListChecks,
  pages: FileText,
  faqs: CircleHelp,
  settings: Settings,
  inbox: Inbox,
  languages: Languages,
};

export function SidebarNav({
  items,
  label,
  verticalFrom = 'lg',
}: {
  items: { href: string; label: string; icon: keyof typeof ICONS }[];
  label: string;
  /** Screen size from which the links stack in a column (a scrolling row below it). */
  verticalFrom?: 'always' | 'md' | 'lg';
}) {
  const pathname = usePathname();
  const isActive = (href: string) =>
    href === '/instructor' || href === '/admin'
      ? pathname === href
      : href === '/instructor/courses'
        ? pathname.startsWith(href) && pathname !== '/instructor/courses/new'
        : pathname.startsWith(href);

  return (
    <nav aria-label={label} className={`flex gap-1 ${verticalFrom === 'always' ? 'flex-col' : verticalFrom === 'md' ? 'overflow-x-auto md:flex-col' : 'overflow-x-auto lg:flex-col'}`}>
      {items.map((item) => {
        const Icon = ICONS[item.icon];
        const active = isActive(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? 'page' : undefined}
            className={`flex items-center gap-3 whitespace-nowrap rounded-full px-4 py-2.5 text-sm font-medium transition-colors ${
              active
                ? 'bg-secondary text-secondary-foreground shadow-sm'
                : 'text-muted-foreground hover:bg-primary-light hover:text-primary'
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
