'use client';

import { SignedMediaUrlSchema } from '@obgyn/types';
import { Button, Label, Textarea } from '@obgyn/ui';
import { Paperclip } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { api } from '@/lib/instructor-api';

/** Approve or request changes, with feedback for the learner. */
export function SubmissionReview({ id, fileAssetId, fileName }: { id: string; fileAssetId: string | null; fileName: string | null }) {
  const t = useTranslations('Instructor');
  const tCommon = useTranslations('Common');
  const router = useRouter();
  const [feedback, setFeedback] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);

  const decide = async (approve: boolean) => {
    setPending(true);
    setError(false);
    try {
      await api('POST', `instructor/submissions/${id}/review`, { approve, feedback: feedback.trim() || null });
      router.refresh();
    } catch {
      setError(true);
    } finally {
      setPending(false);
    }
  };

  const openFile = async () => {
    if (!fileAssetId) return;
    // Short-lived, session-bound URL; opened in a new tab for reading.
    const { url } = SignedMediaUrlSchema.parse(await api('GET', `media/${fileAssetId}/url`));
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="flex flex-col gap-3">
      {fileAssetId ? (
        <button type="button" onClick={openFile} className="flex w-fit items-center gap-2 text-sm font-medium text-primary hover:underline">
          <Paperclip aria-hidden className="size-4" />
          {t('viewFile')}{fileName ? `: ${fileName}` : ''}
        </button>
      ) : null}
      <div className="flex flex-col gap-2">
        <Label htmlFor={`feedback-${id}`}>{t('feedback')}</Label>
        <Textarea id={`feedback-${id}`} rows={2} maxLength={2000} value={feedback} onChange={(e) => setFeedback(e.target.value)} />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" disabled={pending} onClick={() => decide(true)}>{t('approve')}</Button>
        <Button size="sm" variant="outline" disabled={pending} onClick={() => decide(false)}>{t('requestChanges')}</Button>
        {error ? <span role="alert" className="text-sm text-destructive">{tCommon('genericError')}</span> : null}
      </div>
    </div>
  );
}
