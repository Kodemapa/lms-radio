'use client';

import { type PlayerLessonDetail } from '@obgyn/types';
import { ArrowLeft, ArrowRight, Bookmark, Check } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import { InExamSidebar } from './exam-sidebar';

type Question = NonNullable<PlayerLessonDetail['quiz']>['questions'][number];

const KEYS = 'ABCDEFGHIJ';
const pad = (n: number) => String(n).padStart(2, '0');

interface NavState {
  current: number;
  marked: string[];
}

function loadNav(key: string, total: number): NavState {
  try {
    const raw = window.localStorage.getItem(key);
    const parsed = raw ? (JSON.parse(raw) as Partial<NavState>) : {};
    const current = Math.min(Math.max(0, Number(parsed.current) || 0), total - 1);
    return { current, marked: Array.isArray(parsed.marked) ? parsed.marked.filter((id) => typeof id === 'string') : [] };
  } catch {
    return { current: 0, marked: [] };
  }
}

/**
 * Exam layout: one question at a time with Previous / Save & next, "Mark for review",
 * and a question grid showing which are answered, not answered, current or marked.
 * The current question and marks survive a reload (kept with the answers in this browser).
 */
export function ExamQuestions({
  questions,
  answers,
  onToggle,
  onClear,
  navKey,
  disabled,
  onSubmit,
  submitLabel,
  submitDisabled,
  footer,
}: {
  questions: Question[];
  answers: Record<string, string[]>;
  onToggle: (questionId: string, optionId: string, multiple: boolean) => void;
  onClear: (questionId: string) => void;
  /** localStorage key for the current question and marks. */
  navKey: string;
  disabled: boolean;
  onSubmit: () => void;
  submitLabel: string;
  submitDisabled: boolean;
  footer?: React.ReactNode;
}) {
  const t = useTranslations('Exam.nav');
  const total = questions.length;
  const [nav, setNav] = useState<NavState>(() => (typeof window === 'undefined' ? { current: 0, marked: [] } : loadNav(navKey, total)));
  const card = useRef<HTMLDivElement>(null);
  const firstRender = useRef(true);

  useEffect(() => {
    try {
      window.localStorage.setItem(navKey, JSON.stringify(nav));
    } catch {
      // private mode: kept in memory only
    }
  }, [nav, navKey]);

  // Moving to another question: put keyboard / screen-reader focus on it.
  const currentIndex = nav.current;
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    card.current?.focus();
  }, [currentIndex]);

  const question = questions[nav.current]!;
  const isAnswered = (q: Question) => (answers[q.id]?.length ?? 0) > 0;
  const marked = new Set(nav.marked);
  const answeredCount = questions.filter(isAnswered).length;
  const last = nav.current === total - 1;

  const go = (index: number) => setNav((n) => ({ ...n, current: Math.min(Math.max(0, index), total - 1) }));
  const toggleMark = () =>
    setNav((n) => ({ ...n, marked: n.marked.includes(question.id) ? n.marked.filter((id) => id !== question.id) : [...n.marked, question.id] }));

  /** The question grid; `card` = standalone card (phones), else plain (inside the player's right column). */
  const palette = (card: boolean) => (
        <aside aria-labelledby={card ? "exam-grid-title-inline" : "exam-grid-title"} className={card ? 'rounded-[28px] border border-border bg-card p-5 shadow-[0_30px_60px_-40px_rgba(47,35,64,.35)]' : 'p-1'}>
          <h3 id={card ? "exam-grid-title-inline" : "exam-grid-title"} className="mb-4 font-heading text-xl font-semibold">{t('gridTitle')}</h3>
          <ol className={`grid gap-2.5 ${card ? "grid-cols-4 sm:grid-cols-6" : "grid-cols-3"}`}>
            {questions.map((q, i) => {
              const answered = isAnswered(q);
              const current = i === nav.current;
              const review = marked.has(q.id);
              const state = [answered ? t('stateAnswered') : t('stateNotAnswered'), review ? t('stateReview') : null].filter(Boolean).join(', ');
              return (
                <li key={q.id}>
                  <button
                    type="button"
                    onClick={() => go(i)}
                    disabled={disabled}
                    aria-current={current ? 'step' : undefined}
                    aria-label={t('tileLabel', { number: i + 1, state })}
                    className={`relative flex h-16 w-full items-center justify-between rounded-2xl border px-3 text-left disabled:cursor-not-allowed ${
                      current
                        ? 'border-secondary bg-secondary text-secondary-foreground'
                        : answered
                          ? 'border-[#D9CBF0] bg-primary-light'
                          : 'border-[#EDE3F0] bg-card hover:border-primary dark:border-border'
                    }`}
                  >
                    <span className={`font-heading text-lg font-bold ${current ? 'text-secondary-foreground' : 'text-foreground'}`}>{pad(i + 1)}</span>
                    {answered ? (
                      <span
                        aria-hidden
                        className={`grid size-6 place-items-center rounded-full ${current ? 'bg-secondary-foreground text-secondary' : 'bg-secondary text-secondary-foreground'}`}
                      >
                        <Check className="size-3.5" strokeWidth={3} />
                      </span>
                    ) : null}
                    {review ? <span aria-hidden className="absolute -right-1 -top-1 size-3 rounded-full border-2 border-card bg-accent" /> : null}
                  </button>
                </li>
              );
            })}
          </ol>

          <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted-foreground">
            <li className="flex items-center gap-1.5"><span aria-hidden className="size-3 rounded border border-[#D9CBF0] bg-primary-light" />{t('stateAnswered')}</li>
            <li className="flex items-center gap-1.5"><span aria-hidden className="size-3 rounded border border-[#E3D6E6] bg-card" />{t('stateNotAnswered')}</li>
            <li className="flex items-center gap-1.5"><span aria-hidden className="size-3 rounded bg-secondary" />{t('stateCurrent')}</li>
            <li className="flex items-center gap-1.5"><span aria-hidden className="size-3 rounded-full bg-accent" />{t('stateReview')}</li>
          </ul>

          <dl className="mt-4 flex flex-col gap-2 rounded-2xl bg-[linear-gradient(120deg,#F6F0FD_0%,#FBF1F4_55%,#FEF3EA_100%)] p-4 text-sm dark:bg-muted dark:bg-none">
            <div className="flex justify-between font-semibold text-primary">
              <dt>{t('stateAnswered')}</dt>
              <dd className="tabular-nums">{answeredCount}/{total}</dd>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <dt>{t('stateNotAnswered')}</dt>
              <dd className="tabular-nums">{total - answeredCount}/{total}</dd>
            </div>
            <div className="flex justify-between font-semibold text-[#B8551A] dark:text-accent">
              <dt>{t('stateReview')}</dt>
              <dd className="tabular-nums">{marked.size}</dd>
            </div>
          </dl>

          <button
            type="button"
            onClick={onSubmit}
            disabled={submitDisabled}
            className="mt-4 flex min-h-12 w-full items-center justify-between gap-3 rounded-full bg-secondary py-1.5 pl-5 pr-1.5 text-sm font-semibold text-secondary-foreground disabled:opacity-60"
          >
            {submitLabel}
            <span aria-hidden className="grid size-9 place-items-center rounded-full bg-accent text-[#2F2340]">
              <ArrowRight className="size-4" />
            </span>
          </button>
          {footer}
        </aside>
  );

  return (
    <div className="flex flex-col gap-5">
      {/* Question */}
      <section
        ref={card}
        tabIndex={-1}
        aria-labelledby="exam-question-text"
        className="overflow-hidden rounded-[28px] border border-border bg-card shadow-[0_30px_60px_-40px_rgba(47,35,64,.35)] outline-none"
      >
        <div className="flex flex-wrap items-center justify-between gap-3 bg-[linear-gradient(120deg,#F6F0FD_0%,#FBF1F4_55%,#FEF3EA_100%)] px-5 py-4 dark:bg-none sm:px-7">
          <p className="flex items-baseline gap-2">
            <span className="font-heading text-4xl font-bold tracking-tight">{pad(nav.current + 1)}</span>
            <span className="text-sm text-muted-foreground">
              {t('of', { total })} · {question.allowMultiple ? t('multiple') : t('single')}
            </span>
          </p>
          <button
            type="button"
            aria-pressed={marked.has(question.id)}
            onClick={toggleMark}
            disabled={disabled}
            className={`flex min-h-11 items-center gap-2 rounded-full border px-4 text-sm font-semibold transition-colors disabled:opacity-60 ${
              marked.has(question.id) ? 'border-[#F6C8A6] bg-[#FBDCC3] text-[#9A4512]' : 'border-[#E3D6E6] bg-card hover:border-primary'
            }`}
          >
            <Bookmark aria-hidden className={`size-4 ${marked.has(question.id) ? 'fill-accent text-accent' : ''}`} />
            {marked.has(question.id) ? t('marked') : t('markReview')}
          </button>
        </div>

        <fieldset disabled={disabled} className="px-5 py-6 sm:px-7">
          <legend id="exam-question-text" className="mb-5 font-heading text-xl font-semibold leading-snug sm:text-2xl">
            {question.text}
          </legend>
          <div className="grid gap-3 sm:grid-cols-2">
            {question.options.map((option, i) => {
              const picked = !!answers[question.id]?.includes(option.id);
              return (
                <label
                  key={option.id}
                  className={`flex min-h-16 cursor-pointer items-center gap-4 rounded-[22px] border-2 px-4 py-3 text-base transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring ${
                    picked ? 'border-primary bg-[#F5EEFD] dark:bg-primary-light' : 'border-[#EDE3F0] hover:border-primary/60 dark:border-border'
                  }`}
                >
                  <input
                    type={question.allowMultiple ? 'checkbox' : 'radio'}
                    name={`exam-q-${question.id}`}
                    checked={picked}
                    onChange={() => onToggle(question.id, option.id, question.allowMultiple)}
                    className="sr-only"
                  />
                  <span
                    aria-hidden
                    className={`grid size-10 shrink-0 place-items-center rounded-xl text-sm font-bold ${
                      picked ? 'bg-primary text-primary-foreground' : 'bg-[#FBF1EA] text-foreground dark:bg-muted'
                    }`}
                  >
                    {KEYS[i] ?? i + 1}
                  </span>
                  <span className="flex-1">{option.text}</span>
                </label>
              );
            })}
          </div>
        </fieldset>

        <div className="flex flex-wrap items-center gap-3 border-t border-border px-5 py-4 sm:px-7">
          <button
            type="button"
            onClick={() => go(nav.current - 1)}
            disabled={nav.current === 0 || disabled}
            className="flex min-h-11 items-center gap-2 rounded-full border border-[#E3D6E6] bg-card px-5 text-sm font-semibold hover:border-primary disabled:opacity-50"
          >
            <ArrowLeft aria-hidden className="size-4" />
            {t('previous')}
          </button>
          <button
            type="button"
            onClick={() => onClear(question.id)}
            disabled={!isAnswered(question) || disabled}
            className="min-h-11 px-1 text-sm font-medium text-primary underline underline-offset-4 disabled:text-muted-foreground disabled:no-underline"
          >
            {t('clear')}
          </button>
          <span className="ml-auto flex items-center gap-1.5 text-sm text-muted-foreground" role="status">
            {isAnswered(question) ? (
              <>
                <Check aria-hidden className="size-4 text-success" />
                {t('saved')}
              </>
            ) : null}
          </span>
          <button
            type="button"
            onClick={() => (last ? onSubmit() : go(nav.current + 1))}
            disabled={disabled || (last && submitDisabled)}
            className="flex min-h-12 items-center gap-3 rounded-full bg-secondary py-1.5 pl-5 pr-1.5 text-sm font-semibold text-secondary-foreground shadow-[0_12px_24px_-12px_#2F2340] disabled:opacity-60"
          >
            {last ? submitLabel : t('next')}
            <span aria-hidden className="grid size-9 place-items-center rounded-full bg-accent text-secondary dark:text-[#2F2340]">
              <ArrowRight className="size-4" />
            </span>
          </button>
        </div>
      </section>

      <InExamSidebar fallback={palette(true)}>{palette(false)}</InExamSidebar>
    </div>
  );
}
