'use client';

import { QuizResultSchema, type PlayerLessonDetail, type QuizResult } from '@obgyn/types';
import { Button, toast } from '@obgyn/ui';
import { CheckCircle2, RotateCcw, XCircle } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { api } from '@/lib/instructor-api';

type Quiz = NonNullable<PlayerLessonDetail['quiz']>;

export function QuizLesson({ lessonId, quiz, enrolled }: { lessonId: string; quiz: Quiz; enrolled: boolean }) {
  const t = useTranslations('Quiz');
  const tCommon = useTranslations('Common');
  const router = useRouter();
  const [answers, setAnswers] = useState<Record<string, string[]>>({});
  const [result, setResult] = useState<QuizResult | null>(quiz.lastResult);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);

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
    setPending(true);
    setError(false);
    try {
      setResult(QuizResultSchema.parse(await api('POST', `learn/lessons/${lessonId}/quiz`, { answers })));
      toast.success(t('toastSubmitted'));
      router.refresh();
    } catch {
      setError(true);
    } finally {
      setPending(false);
    }
  };

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
              <fieldset disabled={!!result || !enrolled}>
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
          <Button size="lg" disabled={pending} onClick={submit}>
            {pending ? t('submitting') : t('submit')}
          </Button>
          {unanswered > 0 ? <span className="text-sm text-muted-foreground">{t('unanswered', { count: unanswered })}</span> : null}
          {error ? <span role="alert" className="text-sm text-destructive">{tCommon('genericError')}</span> : null}
        </div>
      ) : null}
    </div>
  );
}
