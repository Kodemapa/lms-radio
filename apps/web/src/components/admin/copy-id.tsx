'use client';

import { Check, Copy } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

/** Short user id (first 8 characters) with a copy-full-id icon, for matching audit and support records. */
export function CopyId({ id }: { id: string }) {
  const t = useTranslations('Admin');
  const [copied, setCopied] = useState(false);
  return (
    <span className="inline-flex items-center gap-1">
      <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs" title={id}>
        {id.slice(0, 8)}
      </code>
      <button
        type="button"
        className="inline-flex size-7 items-center justify-center rounded-full text-muted-foreground hover:bg-primary-light hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label={copied ? t('idCopied') : t('copyId')}
        title={copied ? t('idCopied') : t('copyId')}
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(id);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          } catch {
            setCopied(false);
          }
        }}
      >
        {copied ? <Check aria-hidden className="size-3.5 text-success" /> : <Copy aria-hidden className="size-3.5" />}
      </button>
      <span role="status" className="sr-only">
        {copied ? t('idCopied') : ''}
      </span>
    </span>
  );
}
