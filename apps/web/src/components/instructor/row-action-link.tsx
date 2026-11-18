'use client';

import { Eye, Loader2, Pencil } from 'lucide-react';
import { useLinkStatus } from 'next/link';
import { Link } from '@/i18n/navigation';

const ICONS = { edit: Pencil, view: Eye } as const;

/** Spinner shown from the click until the next page has loaded. */
function Pending({ icon }: { icon: keyof typeof ICONS }) {
  const { pending } = useLinkStatus();
  const Icon = pending ? Loader2 : ICONS[icon];
  return <Icon aria-hidden className={`size-4 ${pending ? 'animate-spin' : ''}`} />;
}

/**
 * Icon-only action link for table rows (Edit, View on site). The label is the
 * accessible name and the hover tooltip; the icon turns into a spinner while
 * the target page loads, so a slow page never looks like a dead click.
 */
export function RowActionLink({ href, label, icon, tone = 'default' }: { href: string; label: string; icon: keyof typeof ICONS; tone?: 'primary' | 'default' }) {
  return (
    <Link
      href={href}
      aria-label={label}
      title={label}
      className={`inline-flex size-9 items-center justify-center rounded-full border border-border bg-card transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${
        tone === 'primary' ? 'text-primary' : 'text-foreground'
      }`}
    >
      <Pending icon={icon} />
    </Link>
  );
}
