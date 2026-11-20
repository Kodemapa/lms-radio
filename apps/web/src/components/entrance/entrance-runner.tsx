'use client';

import { EntrancePaperSchema, EntranceResultSchema, type EntrancePaper, type EntranceResult, type EntranceStatus } from '@obgyn/types';
import { Button, toast } from '@obgyn/ui';
import { CheckCircle2, ClipboardCheck, FlaskConical, XCircle } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Link } from '@/i18n/navigation';
import { ApiClientError, api } from '@/lib/instructor-api';

export function EntranceRunner({
  slug,
  initial,
  devSkip = false,
}: {
  slug: string;
  initial: EntranceStatus;
  /** Development builds only: show a button that marks the test as passed. */
  devSkip?: boolean;
}) {
  const t = useTranslations('Entrance');
  const tCommon = useTranslations('Common');
  const router = useRouter();
  const [status, setStatus] = useState(initial);
  const [paper, setPaper] = useState<EntrancePaper | null>(null);
  const [answers, setAnswers] = useState<Record<string, number[]>>({});
  const [result, setResult] = useState<EntranceResult | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const attemptsLeft = status.maxAttempts === null || status.attemptsUsed < status.maxAttempts || !!status.openAttemptId;
  const attemptsText =
    status.maxAttempts === null
      ? t('attemptsUnlimited', { used: status.attemptsUsed })
      : t('attempts', { used: status.attemptsUsed, max: status.maxAttempts });

  const start = async () => {
    setPending(true);
    setError(null);
    try {
      setPaper(EntrancePaperSchema.parse(await api('POST', `courses/${slug}/entrance/attempts`)));
      setAnswers({});
      setResult(null);
    } catch (e) {
      setError(e instanceof ApiClientError && e.body?.code === 'NO_ATTEMPTS_LEFT' ? t('noAttempts') : tCommon('genericError'));
    } finally {
      setPending(false);
    }
  };

  const skip = async () => {
    setPending(true);
    setError(null);
    try {
      await api('POST', `courses/${slug}/entrance/dev-skip`);
      setPaper(null);
      setStatus({ ...status, passed: true, openAttemptId: null });
      router.refresh();
    } catch {
      setError(tCommon('genericError'));
    } finally {
      setPending(false);
    }
  };

  const devSkipButton = devSkip ? (
    <div className="flex flex-col gap-2 rounded-xl border-2 border-dashed border-amber-400 bg-amber-50 p-4 text-amber-900 dark:bg-amber-900/20 dark:text-amber-100">
      <p className="flex items-center gap-2 text-sm font-semibold">
        <FlaskConical aria-hidden className="size-4" />
        {t('devOnly')}
      </p>
      <p className="text-xs">{t('devSkipNote')}</p>
      <Button variant="outline" size="sm" className="w-fit" disabled={pending} onClick={skip}>
        {t('devSkip')}
      </Button>
    </div>
  ) : null;

  const submit = async () => {
    if (!paper) return;
    setPending(true);
    setError(null);
    try {
      const outcome = EntranceResultSchema.parse(await api('POST', `courses/${slug}/entrance/attempts/${paper.attemptId}`, { answers }));
      setResult(outcome);
      setPaper(null);
      if (outcome.passed) toast.success(t('toastPassed'));
      else toast.info(t('toastNotPassed'));
      setStatus({
        ...status,
        passed: outcome.passed,
        attemptsUsed: outcome.attemptsUsed,
        lastScore: outcome.scorePercent,
        openAttemptId: null,
      });
      // Refresh the course content so lessons unlock in the sidebar.
      if (outcome.passed) router.refresh();
    } catch {
      setError(tCommon('genericError'));
    } finally {
      setPending(false);
    }
  };

  if (status.passed) {
    return (
      <div role="status" className="flex flex-col items-start gap-4 rounded-2xl border border-green-300 bg-green-50 p-6 text-green-900 dark:bg-green-900/30 dark:text-green-100">
        <p className="flex items-center gap-2 text-xl font-semibold">
          <CheckCircle2 aria-hidden className="size-6" />
          {result ? t('passedTitle', { score: result.scorePercent }) : t('alreadyPassed')}
        </p>
        <p>{t('passedBody')}</p>
        <Link href={`/learn/${slug}`} className="rounded-full bg-primary px-5 py-2.5 font-medium text-primary-foreground hover:bg-primary-hover">
          {t('startCourse')}
        </Link>
      </div>
    );
  }

  if (paper) {
    const unanswered = paper.questions.filter((q) => !answers[q.id]?.length).length;
    return (
      <div className="flex flex-col gap-5">
        <ol className="flex flex-col gap-4">
          {paper.questions.map((q, index) => (
            <li key={q.id} className="surface p-5">
              <fieldset>
                <legend className="mb-1 font-semibold">{index + 1}. {q.text}</legend>
                <p className="mb-3 text-xs text-muted-foreground">{q.allowMultiple ? t('selectMany') : t('selectOne')}</p>
                <div className="flex flex-col gap-2">
                  {q.options.map((o) => {
                    const picked = answers[q.id]?.includes(o.key) ?? false;
                    return (
                      <label key={o.key} className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 text-sm ${picked ? 'border-primary bg-primary-light' : 'border-border hover:border-primary'}`}>
                        <input
                          type={q.allowMultiple ? 'checkbox' : 'radio'}
                          name={`entrance-${q.id}`}
                          checked={picked}
                          onChange={() =>
                            setAnswers((current) => {
                              const selected = current[q.id] ?? [];
                              const next = q.allowMultiple ? (picked ? selected.filter((k) => k !== o.key) : [...selected, o.key]) : [o.key];
                              return { ...current, [q.id]: next };
                            })
                          }
                          className="size-4 accent-[var(--primary)]"
                        />
                        {o.text}
                      </label>
                    );
                  })}
                </div>
              </fieldset>
            </li>
          ))}
        </ol>
        <div className="flex flex-wrap items-center gap-4">
          <Button size="lg" disabled={pending} onClick={submit}>{pending ? t('submitting') : t('submit')}</Button>
          {unanswered > 0 ? <span className="text-sm text-muted-foreground">{t('unanswered', { count: unanswered })}</span> : null}
          {error ? <span role="alert" className="text-sm text-destructive">{error}</span> : null}
        </div>
        {devSkipButton}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {result ? (
        <div role="status" className="flex flex-col gap-1 rounded-2xl border border-amber-300 bg-amber-50 p-5 text-amber-900 dark:bg-amber-900/30 dark:text-amber-100">
          <p className="flex items-center gap-2 text-lg font-semibold">
            <XCircle aria-hidden className="size-5" />
            {t('failedTitle', { score: result.scorePercent, pass: result.passPercent })}
          </p>
          <p>{t('failedBody', { correct: result.correctCount, total: result.total })}</p>
        </div>
      ) : null}
      <div className="flex flex-col gap-3 surface p-6">
        <p className="flex items-center gap-2 font-semibold">
          <ClipboardCheck aria-hidden className="size-5 text-primary" />
          {t('rules', { count: status.questionCount, pass: status.passPercent })}
        </p>
        <p className="text-sm text-muted-foreground">{attemptsText}</p>
        {attemptsLeft ? (
          <Button size="lg" className="w-fit" disabled={pending} onClick={start}>
            {status.openAttemptId ? t('resume') : result ? t('retry') : t('start')}
          </Button>
        ) : (
          <p role="alert" className="text-destructive">{t('noAttempts')}</p>
        )}
        {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
      </div>
      {devSkipButton}
    </div>
  );
}
