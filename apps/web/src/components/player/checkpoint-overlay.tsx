'use client';

import { CheckpointResultSchema, type VideoCheckpoint } from '@obgyn/types';
import { Button } from '@obgyn/ui';
import { CheckCircle2, CircleHelp, RotateCcw, X, XCircle } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import { formatClock } from '@/lib/format';
import { api } from '@/lib/instructor-api';

/**
 * In-video question. The video stays paused, and later parts stay locked,
 * until the learner picks exactly the right answer. Wrong answers don't
 * reveal the solution; they just ask the learner to try again.
 */
export function CheckpointOverlay({
  lessonId,
  checkpoint,
  onPassed,
  onClose,
  onRewatch,
}: {
  lessonId: string;
  checkpoint: VideoCheckpoint;
  onPassed: (unlockedUntilSec: number | null) => void;
  /** Hide the question; the video stays locked at this point. */
  onClose: () => void;
  /** Close and replay the part just before the question. */
  onRewatch: () => void;
}) {
  const t = useTranslations('Checkpoint');
  const tCommon = useTranslations('Common');
  const [selected, setSelected] = useState<string[]>([]);
  const [state, setState] = useState<'answering' | 'wrong' | 'right' | 'error'>('answering');
  const [explanation, setExplanation] = useState<string | null>(null);
  const [unlocked, setUnlocked] = useState<number | null>(null);
  const [pending, setPending] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);

  useEffect(() => heading.current?.focus(), [checkpoint.id]);

  const toggle = (id: string) =>
    setSelected((current) =>
      checkpoint.allowMultiple ? (current.includes(id) ? current.filter((x) => x !== id) : [...current, id]) : [id],
    );

  const submit = async () => {
    setPending(true);
    try {
      const result = CheckpointResultSchema.parse(
        await api('POST', `learn/lessons/${lessonId}/checkpoints/${checkpoint.id}`, { optionIds: selected }),
      );
      if (result.correct) {
        setExplanation(result.explanation);
        setUnlocked(result.unlockedUntilSec);
        setState('right');
      } else {
        setState('wrong');
        setSelected([]);
      }
    } catch {
      setState('error');
    } finally {
      setPending(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={`cp-${checkpoint.id}`}
      className="relative max-h-full w-full max-w-xl overflow-y-auto rounded-2xl bg-card p-5 text-card-foreground shadow-2xl"
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.stopPropagation();
          if (state === 'right') onPassed(unlocked);
          else onClose();
        }
      }}
    >
      <button
        type="button"
        onClick={() => (state === 'right' ? onPassed(unlocked) : onClose())}
        aria-label={t('close')}
        title={t('close')}
        className="absolute right-3 top-3 rounded-full p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        <X aria-hidden className="size-5" />
      </button>
      <p className="mb-1 flex items-center gap-2 pe-8 text-xs font-medium uppercase tracking-wide text-primary">
        <CircleHelp aria-hidden className="size-4" />
        {t('label', { time: formatClock(checkpoint.atSec) })}
      </p>
      <h2 id={`cp-${checkpoint.id}`} ref={heading} tabIndex={-1} className="mb-1 text-lg font-semibold outline-none">
        {checkpoint.text}
      </h2>
      <p className="mb-3 text-xs text-muted-foreground">{checkpoint.allowMultiple ? t('selectMany') : t('selectOne')}</p>

      {state === 'right' ? (
        <div className="flex flex-col gap-3">
          <p role="status" className="flex items-center gap-2 font-medium text-success">
            <CheckCircle2 aria-hidden className="size-5" />
            {t('correct')}
          </p>
          {explanation ? <p className="rounded-lg bg-muted p-3 text-sm">{explanation}</p> : null}
          <Button autoFocus onClick={() => onPassed(unlocked)}>{t('continue')}</Button>
        </div>
      ) : (
        <fieldset disabled={pending} className="flex flex-col gap-2">
          <legend className="sr-only">{checkpoint.text}</legend>
          {checkpoint.options.map((option) => (
            <label
              key={option.id}
              className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 text-sm ${
                selected.includes(option.id) ? 'border-primary bg-primary-light' : 'border-border hover:border-primary'
              }`}
            >
              <input
                type={checkpoint.allowMultiple ? 'checkbox' : 'radio'}
                name={`cp-${checkpoint.id}-option`}
                checked={selected.includes(option.id)}
                onChange={() => toggle(option.id)}
                className="size-4 accent-[var(--primary)]"
              />
              {option.text}
            </label>
          ))}
          {state === 'wrong' ? (
            <p role="alert" className="flex items-center gap-2 text-sm text-destructive">
              <XCircle aria-hidden className="size-4" />
              {t('wrong')}
            </p>
          ) : null}
          {state === 'error' ? <p role="alert" className="text-sm text-destructive">{tCommon('genericError')}</p> : null}
          <div className="mt-2 flex flex-wrap gap-2">
            <Button disabled={selected.length === 0 || pending} onClick={submit}>
              {pending ? t('checking') : t('submit')}
            </Button>
            <Button type="button" variant="outline" onClick={onRewatch}>
              <RotateCcw aria-hidden className="size-4" />
              {t('rewatch')}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">{t('lockedHint')}</p>
        </fieldset>
      )}
    </div>
  );
}
