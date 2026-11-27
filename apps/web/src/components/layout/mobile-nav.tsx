'use client';

import { Dialog, DialogTitle, DialogTrigger, SheetContent } from '@obgyn/ui';
import { Menu } from 'lucide-react';
import { type ReactNode, useState } from 'react';
import { Link } from '@/i18n/navigation';

export function MobileNav({
  links,
  labels,
  signedIn,
  settings,
}: {
  links: { href: string; label: string }[];
  labels: { menu: string; close: string; signIn: string; register: string };
  signedIn: boolean;
  /** Theme control (in the drawer on phones, where the header has no room). */
  settings?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger className="rounded-full p-2 transition-colors hover:bg-primary-light xl:hidden" aria-label={labels.menu}>
        <Menu aria-hidden className="size-6" />
      </DialogTrigger>
      <SheetContent closeLabel={labels.close} aria-describedby={undefined}>
        <DialogTitle className="text-lg font-semibold">{labels.menu}</DialogTitle>
        {settings ? <div className="flex items-center gap-2 sm:hidden">{settings}</div> : null}
        <nav className="flex flex-col">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setOpen(false)}
              className="rounded-2xl px-3 py-3 font-medium transition-colors hover:bg-primary-light hover:text-primary"
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
              className="rounded-full border border-border py-2.5 text-center font-medium"
            >
              {labels.signIn}
            </Link>
            <Link
              href="/login?mode=register"
              onClick={() => setOpen(false)}
              className="rounded-full bg-secondary py-2.5 text-center font-medium text-secondary-foreground"
            >
              {labels.register}
            </Link>
          </div>
        ) : null}
      </SheetContent>
    </Dialog>
  );
}
