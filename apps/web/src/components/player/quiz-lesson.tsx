'use client';

import { QuizResultSchema, type PlayerLessonDetail, type QuizResult } from '@obgyn/types';
import { Button, toast } from '@obgyn/ui';
import { CheckCircle2, RotateCcw, XCircle } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { ConfirmDialog } from '@/components/instructor/confirm-dialog';
import { api } from '@/lib/instructor-api';
import { ExamQuestions } from './exam-questions';

type Quiz = NonNullable<PlayerLessonDetail['quiz']>;

/** Exam mode: answers survive a reload, one submission, and the parent can submit (time up, ended). */
export interface QuizExamMode {
  /** Where answers are kept in this browser while the exam runs. */
  storageKey: string;
  /** Gives the parent a way to submit (auto-submit at 0:00 or when a proctor ends the exam). */
  registerSubmit: (submit: () => Promise<void>) => void;
  onSubmitted: (result: QuizResult) => void;
  /** Questions are locked, e.g. while the learner is out of full screen. */
  locked?: boolean;
  /** How many questions have an answer (shown to proctors). */
  onProgress?: (answered: number) => void;
}

function loadAnswers(key: string | undefined): Record<string, string[]> {
  if (!key) return {};
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as Record<string, string[]>) : {};
  } catch {
    return {};
  }
}

export function QuizLesson({ lessonId, quiz, enrolled, exam }: { lessonId: string; quiz: Quiz; enrolled: boolean; exam?: QuizExamMode }) {
  const t = useTranslations('Quiz');
  const tExam = useTranslations('Exam');
  const tCommon = useTranslations('Common');
  const router = useRouter();
  const [answers, setAnswers] = useState<Record<string, string[]>>(() => (typeof window === 'undefined' ? {} : loadAnswers(exam?.storageKey)));
  const [result, setResult] = useState<QuizResult | null>(exam ? null : quiz.lastResult);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const answersRef = useRef(answers);
  answersRef.current = answers;
  const submitting = useRef(false);
  // Set to the latest submit below; lets the exam page submit (time up, ended by proctor).
  const submitRef = useRef<() => Promise<void>>(async () => undefined);
  useEffect(() => {
    exam?.registerSubmit(() => submitRef.current());
  }, [exam]);

  useEffect(() => {
    if (!exam) return;
    exam.onProgress?.(Object.values(answers).filter((ids) => ids.length > 0).length);
    try {
      window.localStorage.setItem(exam.storageKey, JSON.stringify(answers));
    } catch {
      // private mode: answers still live in memory
    }
  }, [answers, exam]);

  if (quiz.questions.length === 0) return <p className="text-muted-foreground">{t('empty')}</p>;

  const toggle = (questionId: string, optionId: string, multiple: boolean) =>
    setAnswers((current) => {
      const selected = current[questionId] ?? [];
      const next = multiple
        ? selected.includes(optionId)
          ? selected.filter((id) => id !== optionId)
          : [...selected, optionId]
        : [optionId];
      return { ...current, [questionId]: next };
    });

  const unanswered = quiz.questions.filter((q) => !(answers[q.id]?.length)).length;
  const byQuestion = new Map(result?.questions.map((q) => [q.questionId, q]));

  const submit = async () => {
    if (submitting.current) return;
    submitting.current = true;
    setPending(true);
    setError(false);
    try {
      const graded = QuizResultSchema.parse(await api('POST', `learn/lessons/${lessonId}/quiz`, { answers: answersRef.current }));
      if (exam) {
        try {
          window.localStorage.removeItem(exam.storageKey);
          window.localStorage.removeItem(`${exam.storageKey}:nav`);
        } catch {
          // ignore
        }
        exam.onSubmitted(graded);
      } else {
        setResult(graded);
        toast.success(t('toastSubmitted'));
        router.refresh();
      }
    } catch {
      setError(true);
      submitting.current = false;
    } finally {
      setPending(false);
    }
  };
  submitRef.current = submit;

  if (exam) {
    return (
      <>
        <ExamQuestions
          questions={quiz.questions}
          answers={answers}
          onToggle={toggle}
          onClear={(questionId) => setAnswers((current) => ({ ...current, [questionId]: [] }))}
          navKey={`${exam.storageKey}:nav`}
          disabled={!enrolled || !!exam.locked || pending}
          onSubmit={() => setConfirming(true)}
          submitLabel={pending ? t('submitting') : tExam('submit')}
          submitDisabled={pending || !!exam.locked || !enrolled}
          footer={error ? <p role="alert" className="mt-3 text-sm text-destructive">{tCommon('genericError')}</p> : null}
        />
        <ConfirmDialog
          open={confirming}
          onOpenChange={setConfirming}
          title={tExam('submitConfirmTitle')}
          body={unanswered > 0 ? tExam('submitConfirmUnanswered', { count: unanswered }) : tExam('submitConfirmBody')}
          confirmLabel={tExam('submit')}
          confirmVariant="default"
          onConfirm={submit}
        />
      </>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm text-muted-foreground">
        {t('questionsCount', { count: quiz.questions.length })} · {t('passMark', { percent: quiz.passPercent })}
      </p>

      {result ? (
        <div
          role="status"
          className={`flex flex-wrap items-center justify-between gap-3 rounded-xl p-4 ${
            result.passed ? 'bg-green-50 text-green-900 dark:bg-green-900/30 dark:text-green-100' : 'bg-amber-50 text-amber-900 dark:bg-amber-900/30 dark:text-amber-100'
          }`}
        >
          <p className="flex items-center gap-2 text-lg font-semibold">
            {result.passed ? <CheckCircle2 aria-hidden className="size-6" /> : <XCircle aria-hidden className="size-6" />}
            {result.passed
              ? t('resultPassed', { score: result.scorePercent })
              : t('resultFailed', { score: result.scorePercent, pass: result.passPercent })}
          </p>
          {enrolled ? (
            <Button variant="outline" onClick={() => { setResult(null); setAnswers({}); }}>
              <RotateCcw aria-hidden className="size-4" />
              {t('retry')}
            </Button>
          ) : null}
        </div>
      ) : null}

      <ol className="flex flex-col gap-5">
        {quiz.questions.map((question, index) => {
          const graded = byQuestion.get(question.id);
          const name = `q-${question.id}`;
          return (
            <li key={question.id} className="surface p-5">
              <fieldset disabled={!!result || !enrolled || pending}>
                <legend className="mb-1 font-semibold">
                  {index + 1}. {question.text}
                </legend>
                <p className="mb-3 text-xs text-muted-foreground">{question.allowMultiple ? t('selectMany') : t('selectOne')}</p>
                <div className="flex flex-col gap-2">
                  {question.options.map((option) => {
                    const picked = graded ? graded.selectedOptionIds.includes(option.id) : answers[question.id]?.includes(option.id);
                    const isCorrect = graded?.correctOptionIds.includes(option.id);
                    const tone = graded
                      ? isCorrect
                        ? 'border-green-600 bg-green-50 dark:bg-green-900/30'
                        : picked
                          ? 'border-destructive bg-destructive/5'
                          : 'border-border'
                      : picked
                        ? 'border-primary bg-primary-light'
                        : 'border-border hover:border-primary';
                    return (
                      <label key={option.id} className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 text-sm ${tone}`}>
                        <input
                          type={question.allowMultiple ? 'checkbox' : 'radio'}
                          name={name}
                          checked={!!picked}
                          onChange={() => toggle(question.id, option.id, question.allowMultiple)}
                          className="size-4 accent-[var(--primary)]"
                        />
                        <span className="flex-1">{option.text}</span>
                        {graded && isCorrect ? <span className="text-xs font-medium text-green-700 dark:text-green-300">{t('correctAnswer')}</span> : null}
                        {graded && picked && !isCorrect ? <span className="text-xs font-medium text-destructive">{t('yourChoice')}</span> : null}
                      </label>
                    );
                  })}
                </div>
                {graded ? (
                  <p className={`mt-3 text-sm font-medium ${graded.correct ? 'text-green-700 dark:text-green-300' : 'text-destructive'}`}>
                    {graded.correct ? t('correct') : t('incorrect')}
                  </p>
                ) : null}
                {graded?.explanation ? (
                  <p className="mt-2 rounded-lg bg-muted p-3 text-sm">
                    <span className="font-medium">{t('explanation')}: </span>
                    {graded.explanation}
                  </p>
                ) : null}
              </fieldset>
            </li>
          );
        })}
      </ol>

      {!enrolled ? (
        <p className="text-sm text-muted-foreground">{t('previewOnly')}</p>
      ) : !result ? (
        <div className="flex flex-wrap items-center gap-4">
          <Button size="lg" disabled={pending} onClick={() => void submit()}>
            {pending ? t('submitting') : t('submit')}
          </Button>
          {unanswered > 0 ? <span className="text-sm text-muted-foreground">{t('unanswered', { count: unanswered })}</span> : null}
          {error ? <span role="alert" className="text-sm text-destructive">{tCommon('genericError')}</span> : null}
        </div>
      ) : null}
    </div>
  );
}
