'use client';

import { Dialog, DialogContent, DialogTitle, DialogTrigger } from '@obgyn/ui';
import { PlayCircle } from 'lucide-react';
import { type ReactNode } from 'react';
import { ProtectedPlayer } from '../protected-player';

export function PreviewDialog({
  assetId,
  title,
  label,
  closeLabel,
  children,
}: {
  assetId: string;
  title: string;
  label: string;
  closeLabel: string;
  children: ReactNode;
}) {
  return (
    <Dialog>
      <DialogTrigger className="group relative block w-full overflow-hidden rounded-2xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
        {children}
        <span className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/40 font-medium text-white transition-colors group-hover:bg-black/55">
          <PlayCircle aria-hidden className="size-14" />
          {label}
        </span>
      </DialogTrigger>
      <DialogContent className="max-w-3xl" closeLabel={closeLabel} aria-describedby={undefined}>
        <DialogTitle>{title}</DialogTitle>
        <ProtectedPlayer assetId={assetId} title={title} />
      </DialogContent>
    </Dialog>
  );
}
