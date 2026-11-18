'use client';

import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Label,
  Textarea,
} from '@obgyn/ui';
import { Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { api } from '@/lib/instructor-api';

/** Approve / send back with a note. Used for courses and instructor applications. */
export function ReviewActions({
  approvePath,
  rejectPath,
  approveLabel,
  rejectLabel,
}: {
  approvePath: string;
  rejectPath: string;
  approveLabel: string;
  rejectLabel: string;
}) {
  const t = useTranslations('Instructor');
  const tCommon = useTranslations('Common');
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState('');
  const [pending, setPending] = useState<'approve' | 'reject' | null>(null);
  const [error, setError] = useState(false);

  const decide = async (
    path: string,
    body: { note: string | null },
    which: 'approve' | 'reject',
  ) => {
    setPending(which);
    setError(false);
    try {
      await api('POST', path, body);
      setOpen(false);
      router.refresh();
    } catch {
      setError(true);
    } finally {
      setPending(null);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        size="sm"
        disabled={pending !== null}
        aria-busy={pending === 'approve'}
        onClick={() => decide(approvePath, { note: null }, 'approve')}
      >
        {pending === 'approve' ? <Loader2 aria-hidden className="size-4 animate-spin" /> : null}
        {approveLabel}
      </Button>
      <Button size="sm" variant="outline" disabled={pending !== null} onClick={() => setOpen(true)}>
        {rejectLabel}
      </Button>
      {error ? (
        <span role="alert" className="text-sm text-destructive">
          {tCommon('genericError')}
        </span>
      ) : null}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent closeLabel={tCommon('close')} aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>{rejectLabel}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <Label htmlFor="review-note">{t('rejectNote')}</Label>
            <Textarea
              id="review-note"
              rows={4}
              maxLength={1000}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              {tCommon('cancel')}
            </Button>
            <Button
              disabled={pending !== null}
              aria-busy={pending === 'reject'}
              onClick={() => decide(rejectPath, { note: note.trim() || null }, 'reject')}
            >
              {pending === 'reject' ? (
                <Loader2 aria-hidden className="size-4 animate-spin" />
              ) : null}
              {rejectLabel}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
