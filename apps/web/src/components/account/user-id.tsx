'use client';

import { toast } from '@obgyn/ui';
import { Check, Copy } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

/**
 * The signed-in user's ID with a copy button, so learners and instructors can
 * quote it to support. `short` shows the first 8 characters (enough to find
 * the account); the copy button always copies the full ID.
 */
export function UserId({ id, short = false, className = '' }: { id: string; short?: boolean; className?: string }) {
  const t = useTranslations('Common');
  const [copied, setCopied] = useState(false);

  const copy = async (event: React.MouseEvent) => {
    // Inside menus: copying shouldn't also close the menu or follow a link.
    event.preventDefault();
    event.stopPropagation();
    try {
      await navigator.clipboard.writeText(id);
      setCopied(true);
      toast.success(t('userIdCopied'));
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error(t('genericError'));
    }
  };

  return (
    <span className={`inline-flex min-w-0 items-center gap-1.5 text-xs ${className}`}>
      <span className="shrink-0 text-muted-foreground">{t('userId')}:</span>
      <code className="truncate rounded bg-muted px-1.5 py-0.5 font-mono text-foreground" title={id}>
        {short ? id.slice(0, 8) : id}
      </code>
      <button
        type="button"
        onClick={copy}
        onPointerDown={(event) => event.stopPropagation()}
        aria-label={t('copyUserId')}
        title={t('copyUserId')}
        className="inline-flex size-6 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-primary-light hover:text-primary focus-visible:outline-2 focus-visible:outline-ring"
      >
        {copied ? <Check aria-hidden className="size-3.5 text-success" /> : <Copy aria-hidden className="size-3.5" />}
      </button>
    </span>
  );
}
