'use client';

import { SignedMediaUrlSchema } from '@obgyn/types';
import { Button, Textarea, toast } from '@obgyn/ui';
import { Check, Loader2, Paperclip, RotateCcw } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { api } from '@/lib/instructor-api';

/** The learner's attached file, opened through a short-lived, session-bound URL. */
export function SubmissionAttachment({ fileAssetId, fileName }: { fileAssetId: string; fileName: string | null }) {
  const t = useTranslations('Instructor');
  const tCommon = useTranslations('Common');
  const [opening, setOpening] = useState(false);

  const open = async () => {
    setOpening(true);
    try {
      const { url } = SignedMediaUrlSchema.parse(await api('GET', `media/${fileAssetId}/url`));
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch {
      toast.error(tCommon('genericError'));
    } finally {
      setOpening(false);
    }
  };

  return (
    <button
      type="button"
      onClick={open}
      disabled={opening}
      className="flex w-fit max-w-full items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-sm font-medium text-primary transition-colors hover:border-primary/50 disabled:opacity-60"
    >
      {opening ? <Loader2 aria-hidden className="size-4 shrink-0 animate-spin" /> : <Paperclip aria-hidden className="size-4 shrink-0" />}
      <span className="truncate">{fileName || t('viewFile')}</span>
    </button>
  );
}

/** Reply box: feedback for the learner, then approve or request changes. */
export function SubmissionReview({ id }: { id: string }) {
  const t = useTranslations('Instructor');
  const tCommon = useTranslations('Common');
  const router = useRouter();
  const [feedback, setFeedback] = useState('');
  const [pending, setPending] = useState<'approve' | 'return' | null>(null);

  const decide = async (approve: boolean) => {
    setPending(approve ? 'approve' : 'return');
    try {
      await api('POST', `instructor/submissions/${id}/review`, { approve, feedback: feedback.trim() || null });
      toast.success(approve ? t('submissionApproved') : t('submissionReturned'));
      router.refresh();
    } catch {
      toast.error(tCommon('genericError'));
    } finally {
      setPending(null);
    }
  };

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border bg-background/60 p-3 sm:p-4">
      <label htmlFor={`feedback-${id}`} className="text-sm font-semibold">
        {t('feedback')}
      </label>
      <Textarea
        id={`feedback-${id}`}
        rows={3}
        maxLength={2000}
        value={feedback}
        placeholder={t('feedbackPlaceholder')}
        onChange={(e) => setFeedback(e.target.value)}
      />
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button size="sm" variant="outline" disabled={!!pending} onClick={() => decide(false)}>
          {pending === 'return' ? <Loader2 aria-hidden className="size-4 animate-spin" /> : <RotateCcw aria-hidden className="size-4" />}
          {t('requestChanges')}
        </Button>
        <Button size="sm" disabled={!!pending} onClick={() => decide(true)}>
          {pending === 'approve' ? <Loader2 aria-hidden className="size-4 animate-spin" /> : <Check aria-hidden className="size-4" />}
          {t('approve')}
        </Button>
      </div>
    </div>
  );
}
