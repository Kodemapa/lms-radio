'use client';

import {
  AssessmentReportSchema,
  AssessmentSummarySchema,
  AttemptDetailSchema,
  AttemptWorkingSchema,
  WorkingReviewSchema,
  type AssessmentKind,
  type AttemptWorking,
  type WorkingStatus,
  type AssessmentReport,
  type AssessmentSummary,
  type AttemptDetail,
} from '@obgyn/types';
import { Button, Dialog, DialogContent, DialogHeader, DialogTitle, Textarea, toast } from '@obgyn/ui';
import { ArrowLeft, CheckCircle2, MinusCircle, XCircle } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { z } from 'zod';
import { Meter } from '@/components/charts/day-bars';
import { WorkingStatusBadge, WorkingView } from '@/components/imaging/working-view';
import { api } from '@/lib/instructor-api';

const KIND_PATH: Record<AssessmentKind, string> = { QUIZ: 'quiz', IMAGING: 'imaging', ENTRANCE: 'entrance' };

/** Quizzes, DICOM cases and the entrance test: who attempted, how they did, which items trip learners up. */
export function ReportsTab({ courseId }: { courseId: string }) {
  const t = useTranslations('Teaching');
  const [list, setList] = useState<AssessmentSummary[] | null>(null);
  const [open, setOpen] = useState<AssessmentSummary | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    api('GET', `instructor/courses/${courseId}/assessments`)
      .then((d) => setList(z.array(AssessmentSummarySchema).parse(d)))
      .catch(() => setError(true));
  }, [courseId]);

  if (error) return <p role="alert" className="text-sm text-destructive">{t('loadFailed')}</p>;
  if (!list) return <p role="status" className="text-sm text-muted-foreground">{t('loading')}</p>;
  if (open) return <Report courseId={courseId} summary={open} onBack={() => setOpen(null)} />;
  if (!list.length) return <p className="rounded-2xl border border-dashed border-primary/25 bg-primary-light/40 p-8 text-center text-muted-foreground">{t('noAssessments')}</p>;

  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full text-left text-sm">
        <thead className="bg-muted/60 text-xs uppercase text-muted-foreground">
          <tr>
            <th scope="col" className="px-3 py-2">{t('assessment')}</th>
            <th scope="col" className="px-3 py-2">{t('learners')}</th>
            <th scope="col" className="px-3 py-2">{t('passRate')}</th>
            <th scope="col" className="px-3 py-2">{t('avgBest')}</th>
            <th scope="col" className="px-3 py-2">{t('attempts')}</th>
            <th scope="col" className="px-3 py-2"><span className="sr-only">{t('actions')}</span></th>
          </tr>
        </thead>
        <tbody>
          {list.map((a) => (
            <tr key={a.lessonId ?? 'entrance'} className="border-t border-border">
              <td className="px-3 py-2">
                <span className="block font-medium">{a.kind === 'ENTRANCE' ? t('entranceTest') : a.title}</span>
                <span className="text-xs text-muted-foreground">{t(`kind.${a.kind}`)} · {t('passMark', { percent: a.passPercent })}</span>
              </td>
              <td className="px-3 py-2 tabular-nums">{a.learners}</td>
              <td className="px-3 py-2">
                {a.learners ? <Meter percent={Math.round((a.passedLearners / a.learners) * 100)} label={t('passRateOf', { title: a.title })} /> : '—'}
              </td>
              <td className="px-3 py-2 tabular-nums">{a.averageBestScore === null ? '—' : `${a.averageBestScore}%`}</td>
              <td className="px-3 py-2 tabular-nums">{a.attempts}</td>
              <td className="px-3 py-2 text-end">
                <Button variant="outline" size="sm" disabled={!a.attempts} onClick={() => setOpen(a)}>{t('viewReport')}</Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Report({ courseId, summary, onBack }: { courseId: string; summary: AssessmentSummary; onBack: () => void }) {
  const t = useTranslations('Teaching');
  const tWorking = useTranslations('Working');
  const tImg = useTranslations('Imaging');
  const locale = useLocale();
  const [report, setReport] = useState<AssessmentReport | null>(null);
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    const path = summary.lessonId ? `instructor/courses/${courseId}/assessments/${summary.lessonId}` : `instructor/courses/${courseId}/assessments/entrance`;
    api('GET', path).then((d) => setReport(AssessmentReportSchema.parse(d))).catch(() => setError(true));
  }, [courseId, summary.lessonId]);

  /** Imaging reports name failure reasons by code; show them in words. */
  const mistake = (value: string | null) =>
    value && summary.kind === 'IMAGING' && /^[A-Z_]+$/.test(value) ? tImg(`reason.${value}`) : (value ?? '—');

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="outline" size="sm" onClick={onBack}>
          <ArrowLeft aria-hidden className="size-4" />
          {t('allAssessments')}
        </Button>
        <h3 className="text-lg font-semibold">{summary.kind === 'ENTRANCE' ? t('entranceTest') : summary.title}</h3>
      </div>
      {error ? <p role="alert" className="text-sm text-destructive">{t('loadFailed')}</p> : null}
      {!report ? (
        !error ? <p role="status" className="text-sm text-muted-foreground">{t('loading')}</p> : null
      ) : (
        <>
          <section className="flex flex-col gap-2">
            <h4 className="font-semibold">{t('itemAnalysis')}</h4>
            <p className="text-sm text-muted-foreground">{t('itemAnalysisHint')}</p>
            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full text-left text-sm">
                <thead className="bg-muted/60 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th scope="col" className="px-3 py-2">{t('item')}</th>
                    <th scope="col" className="px-3 py-2">{t('correct')}</th>
                    <th scope="col" className="px-3 py-2">{t('commonMistake')}</th>
                  </tr>
                </thead>
                <tbody>
                  {[...report.items].sort((a, b) => a.correctPercent - b.correctPercent).map((item) => (
                    <tr key={item.id} className="border-t border-border align-top">
                      <td className="px-3 py-2">{item.label}</td>
                      <td className="px-3 py-2">
                        <Meter percent={item.correctPercent} label={t('correctOf', { item: item.label })} />
                        <span className="text-xs text-muted-foreground">{t('answeredBy', { count: item.answered })}</span>
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">{mistake(item.commonMistake)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
          <section className="flex flex-col gap-2">
            <h4 className="font-semibold">{t('learnerResults')}</h4>
            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full text-left text-sm">
                <thead className="bg-muted/60 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th scope="col" className="px-3 py-2">{t('student')}</th>
                    <th scope="col" className="px-3 py-2">{t('attempts')}</th>
                    <th scope="col" className="px-3 py-2">{t('best')}</th>
                    <th scope="col" className="px-3 py-2">{t('last')}</th>
                    <th scope="col" className="px-3 py-2">{t('result')}</th>
                    <th scope="col" className="px-3 py-2"><span className="sr-only">{t('actions')}</span></th>
                  </tr>
                </thead>
                <tbody>
                  {report.learners.map((l) => (
                    <tr key={l.userId} className="border-t border-border">
                      <td className="px-3 py-2">
                        <span className="block font-medium">{l.displayName}</span>
                        <span className="text-xs text-muted-foreground">{new Date(l.lastAttemptAt).toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'short' })}</span>
                      </td>
                      <td className="px-3 py-2 tabular-nums">{l.attempts}</td>
                      <td className="px-3 py-2 tabular-nums">{l.bestScore}%</td>
                      <td className="px-3 py-2 tabular-nums">{l.lastScore}%</td>
                      <td className="px-3 py-2">
                        <span className={`inline-flex items-center gap-1 ${l.passed ? 'text-success' : 'text-destructive'}`}>
                          {l.passed ? <CheckCircle2 aria-hidden className="size-4" /> : <XCircle aria-hidden className="size-4" />}
                          {l.passed ? t('passed') : t('notPassed')}
                        </span>
                        {l.workingStatus ? <span className="mt-1 block"><WorkingStatusBadge status={l.workingStatus} /></span> : null}
                      </td>
                      <td className="px-3 py-2 text-end">
                        <Button variant={l.workingStatus === 'PENDING' ? 'default' : 'outline'} size="sm" onClick={() => setAttemptId(l.lastAttemptId)}>
                          {l.workingStatus === 'PENDING' ? tWorking('checkWorking') : t('viewAttempt')}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
      {attemptId ? (
        <AttemptDialog
          kind={summary.kind}
          attemptId={attemptId}
          onClose={() => setAttemptId(null)}
          onReviewed={(status) =>
            setReport((current) =>
              current ? { ...current, learners: current.learners.map((x) => (x.lastAttemptId === attemptId ? { ...x, workingStatus: status } : x)) } : current,
            )
          }
        />
      ) : null}
    </div>
  );
}

function AttemptDialog({
  kind,
  attemptId,
  onClose,
  onReviewed,
}: {
  kind: AssessmentKind;
  attemptId: string;
  onClose: () => void;
  onReviewed: (status: WorkingStatus) => void;
}) {
  const t = useTranslations('Teaching');
  const tWorking = useTranslations('Working');
  const tCommon = useTranslations('Common');
  const locale = useLocale();
  const [detail, setDetail] = useState<AttemptDetail | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    api('GET', `instructor/attempts/${KIND_PATH[kind]}/${attemptId}`).then((d) => setDetail(AttemptDetailSchema.parse(d))).catch(() => setError(true));
  }, [kind, attemptId]);

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent keepOpenOnOutsideClick className="max-h-[90vh] max-w-3xl overflow-y-auto" closeLabel={tCommon('close')} aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>{detail ? t('attemptTitle', { name: detail.learner.displayName }) : t('loading')}</DialogTitle>
        </DialogHeader>
        {error ? <p role="alert" className="text-sm text-destructive">{t('loadFailed')}</p> : null}
        {detail ? (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-muted-foreground">
              {detail.title} · {new Date(detail.createdAt).toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'short' })} · {detail.scorePercent}% ·{' '}
              {detail.passed ? t('passed') : t('notPassed')}
            </p>
            <ol className="flex flex-col gap-2">
              {detail.items.map((item, i) => (
                <li key={i} className="rounded-lg border border-border p-3 text-sm">
                  <p className="flex items-start gap-2 font-medium">
                    {item.correct ? (
                      <CheckCircle2 aria-label={t('correct')} className="mt-0.5 size-4 shrink-0 text-success" />
                    ) : item.credit > 0 ? (
                      <MinusCircle aria-label={t('partly')} className="mt-0.5 size-4 shrink-0 text-amber-600" />
                    ) : (
                      <XCircle aria-label={t('incorrect')} className="mt-0.5 size-4 shrink-0 text-destructive" />
                    )}
                    {item.label}
                  </p>
                  <dl className="ms-6 mt-1 grid grid-cols-[auto_1fr] gap-x-3 text-xs">
                    <dt className="text-muted-foreground">{t('answer')}</dt>
                    <dd>{item.answer ?? '—'}</dd>
                    <dt className="text-muted-foreground">{t('expected')}</dt>
                    <dd>{item.expected}</dd>
                  </dl>
                </li>
              ))}
            </ol>
            {detail.working ? (
              <>
                <WorkingView working={detail.working} />
                <WorkingReviewForm
                  attemptId={detail.id}
                  current={detail.working}
                  onSaved={(working) => {
                    setDetail({ ...detail, working });
                    onReviewed(working.status);
                  }}
                />
              </>
            ) : kind === 'IMAGING' ? (
              <p className="text-sm text-muted-foreground">{tWorking('noneSubmitted')}</p>
            ) : null}
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

/** Verify the learner's working, or return it with what to correct. */
function WorkingReviewForm({ attemptId, current, onSaved }: { attemptId: string; current: AttemptWorking; onSaved: (working: AttemptWorking) => void }) {
  const t = useTranslations('Working');
  const tCommon = useTranslations('Common');
  const [feedback, setFeedback] = useState(current.feedback ?? '');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async (status: 'VERIFIED' | 'RETURNED') => {
    const body = WorkingReviewSchema.safeParse({ status, feedback: feedback.trim() || null });
    if (!body.success) return setError(t('feedbackNeeded'));
    setPending(true);
    setError(null);
    try {
      onSaved(AttemptWorkingSchema.parse(await api('PUT', `instructor/imaging-attempts/${attemptId}/working`, body.data)));
      toast.success(tCommon('toast.reviewSent'));
    } catch {
      setError(tCommon('genericError'));
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-primary/30 bg-primary-light/40 p-4">
      <label htmlFor={`feedback-${attemptId}`} className="text-sm font-medium">{t('feedbackLabel')}</label>
      <Textarea id={`feedback-${attemptId}`} rows={3} maxLength={2000} value={feedback} placeholder={t('feedbackPlaceholder')} onChange={(e) => setFeedback(e.target.value)} />
      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
      <div className="flex flex-wrap gap-2">
        <Button size="sm" disabled={pending} onClick={() => void save('VERIFIED')}>
          <CheckCircle2 aria-hidden className="size-4" />
          {t('verify')}
        </Button>
        <Button size="sm" variant="outline" disabled={pending} onClick={() => void save('RETURNED')}>
          {t('return')}
        </Button>
      </div>
    </div>
  );
}
