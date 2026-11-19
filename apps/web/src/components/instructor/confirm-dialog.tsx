'use client';

import { Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@obgyn/ui';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

/** Confirmation dialog; destructive styling unless `confirmVariant` says otherwise. */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  body,
  confirmLabel,
  onConfirm,
  confirmVariant = 'destructive',
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  body: string;
  confirmLabel: string;
  onConfirm: () => Promise<void>;
  confirmVariant?: 'destructive' | 'default';
}) {
  const t = useTranslations('Common');
  const [pending, setPending] = useState(false);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent closeLabel={t('close')}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{body}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t('cancel')}</Button>
          <Button
            variant={confirmVariant}
            disabled={pending}
            onClick={async () => {
              setPending(true);
              try {
                await onConfirm();
                onOpenChange(false);
              } finally {
                setPending(false);
              }
            }}
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
