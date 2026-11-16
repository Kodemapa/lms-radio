'use client';

import { Dialog, DialogTitle, DialogTrigger, SheetContent } from '@obgyn/ui';
import { Menu } from 'lucide-react';
import { useState } from 'react';
import { Link } from '@/i18n/navigation';

export function MobileNav({
  links,
  labels,
  signedIn,
}: {
  links: { href: string; label: string }[];
  labels: { menu: string; close: string; signIn: string; register: string };
  signedIn: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger className="rounded-md p-2 hover:bg-muted xl:hidden" aria-label={labels.menu}>
        <Menu aria-hidden className="size-6" />
      </DialogTrigger>
      <SheetContent closeLabel={labels.close} aria-describedby={undefined}>
        <DialogTitle className="text-lg font-semibold">{labels.menu}</DialogTitle>
        <nav className="flex flex-col">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setOpen(false)}
              className="border-b border-border py-3 font-medium hover:text-primary"
            >
              {link.label}
            </Link>
          ))}
        </nav>
        {!signedIn ? (
          <div className="mt-auto flex flex-col gap-2">
            <Link
              href="/login"
              onClick={() => setOpen(false)}
              className="rounded-[4px] border border-border py-2.5 text-center font-medium"
            >
              {labels.signIn}
            </Link>
            <Link
              href="/login?mode=register"
              onClick={() => setOpen(false)}
              className="rounded-[4px] bg-secondary py-2.5 text-center font-medium text-secondary-foreground"
            >
              {labels.register}
            </Link>
          </div>
        ) : null}
      </SheetContent>
    </Dialog>
  );
}
