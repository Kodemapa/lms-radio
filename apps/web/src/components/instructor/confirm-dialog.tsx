'use client';

import { Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, toast } from '@obgyn/ui';
import { useTranslations } from 'next-intl';
import { useState, type ReactNode } from 'react';
import { ApiClientError } from '@/lib/instructor-api';

/**
 * "Are you sure you want to delete …?" for delete buttons inside forms.
 * `confirmDelete(run, name)` opens the dialog; `run` happens only after Delete
 * is pressed. Render `dialog` once in the component.
 */
export function useConfirmDelete(): {
  confirmDelete: (run: () => void | Promise<void>, name?: string) => void;
  dialog: ReactNode;
} {
  const t = useTranslations('Common');
  const [pending, setPending] = useState<{ run: () => void | Promise<void>; name?: string } | null>(null);
  return {
    confirmDelete: (run, name) => setPending({ run, name }),
    dialog: (
      <ConfirmDialog
        open={pending !== null}
        onOpenChange={(open) => !open && setPending(null)}
        title={pending?.name ? t('deleteNamedTitle', { name: pending.name }) : t('deleteConfirmTitle')}
        body={t('deleteConfirmBody')}
        confirmLabel={t('delete')}
        onConfirm={async () => {
          await pending?.run();
        }}
      />
    ),
  };
}

/**
 * Confirmation dialog; destructive styling unless `confirmVariant` says otherwise.
 * With `successMessage`, a toast confirms the action. A failed action shows an
 * error toast and keeps the dialog open so it can be retried.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  body,
  confirmLabel,
  onConfirm,
  confirmVariant = 'destructive',
  successMessage,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  body: string;
  confirmLabel: string;
  onConfirm: () => Promise<void>;
  confirmVariant?: 'destructive' | 'default';
  successMessage?: string;
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
                if (successMessage) toast.success(successMessage);
              } catch (error) {
                const message = error instanceof ApiClientError && error.status < 500 ? error.messageText : null;
                toast.error(message ?? t('genericError'));
              } finally {
                setPending(false);
              }
            }}
          >
            {pending ? t('working') : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
