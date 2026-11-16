'use client';

import { MySubmissionSchema, type PlayerLessonDetail } from '@obgyn/types';
import { Button, Label, Textarea } from '@obgyn/ui';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { api } from '@/lib/instructor-api';
import { FileUpload } from '../instructor/editor/file-upload';

type Assignment = NonNullable<PlayerLessonDetail['assignment']>;

const STATUS_TONE = {
  SUBMITTED: 'bg-primary-light text-primary',
  APPROVED: 'bg-green-50 text-green-900 dark:bg-green-900/30 dark:text-green-100',
  REJECTED: 'bg-amber-50 text-amber-900 dark:bg-amber-900/30 dark:text-amber-100',
} as const;

const MIME: Record<'IMAGE' | 'PDF', string[]> = {
  IMAGE: ['image/jpeg', 'image/png', 'image/webp'],
  PDF: ['application/pdf'],
};

export function AssignmentLesson({
  lessonId,
  assignment,
  enrolled,
}: {
  lessonId: string;
  assignment: Assignment;
  enrolled: boolean;
}) {
  const t = useTranslations('Assignment');
  const tCommon = useTranslations('Common');
  const router = useRouter();
  const [submission, setSubmission] = useState(assignment.submission);
  const [text, setText] = useState(assignment.submission?.text ?? '');
  const [file, setFile] = useState<{ id: string; name: string } | null>(
    assignment.submission?.fileAssetId ? { id: assignment.submission.fileAssetId, name: assignment.submission.fileName ?? '' } : null,
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const canSubmit = enrolled && submission?.status !== 'APPROVED';
  const kinds = assignment.submissionKinds;

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!text.trim() && !file) return setError(t('needContent'));
    setPending(true);
    setError(null);
    try {
      const saved = MySubmissionSchema.parse(
        await api('PUT', `learn/lessons/${lessonId}/assignment`, { text: text.trim() || null, fileAssetId: file?.id ?? null }),
      );
      setSubmission(saved);
      router.refresh();
    } catch {
      setError(tCommon('genericError'));
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <section className="surface p-5">
        <h2 className="mb-2 flex flex-wrap items-baseline justify-between gap-2 font-semibold">
          {t('instructions')}
          {assignment.points ? <span className="text-sm font-normal text-muted-foreground">{t('points', { points: assignment.points })}</span> : null}
        </h2>
        <p className="whitespace-pre-line">{assignment.instructions}</p>
      </section>

      {submission ? (
        <div role="status" className={`rounded-xl p-4 text-sm ${STATUS_TONE[submission.status]}`}>
          <p className="font-medium">{t(`status.${submission.status}`)}</p>
          {submission.feedback ? <p className="mt-1">{t('feedback', { feedback: submission.feedback })}</p> : null}
        </div>
      ) : null}

      {!enrolled ? (
        <p className="text-sm text-muted-foreground">{t('previewOnly')}</p>
      ) : canSubmit ? (
        <form onSubmit={submit} className="flex flex-col gap-4 surface p-5">
          <div className="flex flex-col gap-2">
            <Label htmlFor="assignment-answer">{t('yourAnswer')}</Label>
            <Textarea id="assignment-answer" rows={8} maxLength={10000} value={text} onChange={(e) => setText(e.target.value)} />
          </div>
          {kinds.length > 0 ? (
            <FileUpload
              scope="learner"
              kind={kinds[0]!}
              accept={kinds.flatMap((k) => MIME[k])}
              label={t('attach')}
              hint={t('accepted', { kinds: kinds.map((k) => (k === 'PDF' ? 'PDF' : 'JPG / PNG / WebP')).join(', ') })}
              currentName={file?.name ?? null}
              onUploaded={({ assetId, fileName }) => setFile({ id: assetId, name: fileName })}
            />
          ) : null}
          {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
          <Button type="submit" size="lg" disabled={pending} className="w-fit">
            {pending ? t('submitting') : submission ? t('resubmit') : t('submit')}
          </Button>
        </form>
      ) : null}
    </div>
  );
}
