'use client';

import { Dialog, DialogTitle, DialogTrigger, SheetContent } from '@obgyn/ui';
import { ArrowLeft, Menu } from 'lucide-react';
import { type ComponentProps, useEffect, useState } from 'react';
import { SidebarNav } from '@/components/instructor/sidebar-nav';
import { Link, usePathname } from '@/i18n/navigation';

/**
 * Phones: the admin menu as a vertical sidebar that slides in from the left (the screen
 * is too narrow to keep it open beside the page). Closes after choosing a page.
 */
export function AdminMobileNav({
  items,
  labels,
}: {
  items: ComponentProps<typeof SidebarNav>['items'];
  labels: { menu: string; close: string; title: string; backToSite: string };
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  useEffect(() => setOpen(false), [pathname]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        aria-label={labels.menu}
        className="flex size-10 shrink-0 items-center justify-center rounded-full border border-border bg-card transition-colors hover:border-primary/40 hover:text-primary md:hidden"
      >
        <Menu aria-hidden className="size-5" />
      </DialogTrigger>
      <SheetContent side="left" closeLabel={labels.close} aria-describedby={undefined} className="flex flex-col gap-4 overflow-y-auto">
        <DialogTitle className="text-lg font-semibold">{labels.title}</DialogTitle>
        <SidebarNav items={items} label={labels.title} verticalFrom="always" />
        <Link href="/" className="mt-2 flex items-center gap-2 px-4 text-sm text-muted-foreground hover:text-primary">
          <ArrowLeft aria-hidden className="size-4 rtl:rotate-180" />
          {labels.backToSite}
        </Link>
      </SheetContent>
    </Dialog>
  );
}
