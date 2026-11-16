'use client';

import { SignedMediaUrlSchema, type AttemptWorking } from '@obgyn/types';
import { CheckCircle2, Clock3, FileText, Image as ImageIcon, RotateCcw } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { api } from '@/lib/instructor-api';

const STATUS = {
  PENDING: { Icon: Clock3, className: 'bg-muted text-muted-foreground' },
  VERIFIED: { Icon: CheckCircle2, className: 'bg-success/15 text-success' },
  RETURNED: { Icon: RotateCcw, className: 'bg-destructive/10 text-destructive' },
} as const;

export function WorkingStatusBadge({ status }: { status: AttemptWorking['status'] }) {
  const t = useTranslations('Working');
  const { Icon, className } = STATUS[status];
  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${className}`}>
      <Icon aria-hidden className="size-3.5" />
      {t(`status.${status}`)}
    </span>
  );
}

/**
 * A learner's working on a DICOM case: their explanation, photos / PDFs of
 * handwritten calculations (opened through short-lived signed URLs), and the
 * faculty check. Shown to the learner and to the course team.
 */
export function WorkingView({ working }: { working: AttemptWorking }) {
  const t = useTranslations('Working');
  const locale = useLocale();
  const [error, setError] = useState(false);

  const openFile = async (assetId: string) => {
    setError(false);
    try {
      const { url } = SignedMediaUrlSchema.parse(await api('GET', `media/${assetId}/url`));
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch {
      setError(true);
    }
  };

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="font-semibold">{t('heading')}</h4>
        <WorkingStatusBadge status={working.status} />
      </div>
      {working.explanation ? (
        <p className="whitespace-pre-line rounded-lg bg-muted/60 p-3 text-sm">{working.explanation}</p>
      ) : (
        <p className="text-sm text-muted-foreground">{t('noExplanation')}</p>
      )}
      {working.files.length ? (
        <ul className="flex flex-wrap gap-2">
          {working.files.map((file) => (
            <li key={file.assetId}>
              <button type="button" onClick={() => void openFile(file.assetId)} className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm hover:border-primary hover:text-primary">
                {file.kind === 'PDF' ? <FileText aria-hidden className="size-4" /> : <ImageIcon aria-hidden className="size-4" />}
                <span className="max-w-48 truncate">{file.name}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {error ? <p role="alert" className="text-sm text-destructive">{t('openFailed')}</p> : null}
      {working.status !== 'PENDING' ? (
        <div className={`rounded-lg p-3 text-sm ${working.status === 'VERIFIED' ? 'bg-success/10' : 'bg-destructive/5'}`}>
          <p className="font-medium">
            {t(working.status === 'VERIFIED' ? 'verifiedBy' : 'returnedBy', {
              name: working.reviewedBy ?? '—',
              date: working.reviewedAt ? new Date(working.reviewedAt).toLocaleDateString(locale, { dateStyle: 'medium' }) : '',
            })}
          </p>
          {working.feedback ? <p className="mt-1 whitespace-pre-line">{working.feedback}</p> : null}
        </div>
      ) : null}
    </div>
  );
}
