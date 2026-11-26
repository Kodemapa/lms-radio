'use client';

import { ExamReportSchema, type ExamReport, type ProctorEventKind, type ProctorEventView } from '@obgyn/types';
import { Image as ImageIcon, ShieldAlert, ShieldCheck, ShieldQuestion } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { api } from '@/lib/instructor-api';

/** Routine events left out of the timeline. */
const QUIET: ReadonlySet<ProctorEventKind> = new Set(['TAB_VISIBLE', 'FULLSCREEN_ENTER', 'CAMERA_ON']);
const SERIOUS: ReadonlySet<ProctorEventKind> = new Set([
  'WARNING',
  'TERMINATED',
  'MULTIPLE_FACES',
  'PROHIBITED_OBJECT',
  'SECOND_SCREEN',
  'TAB_HIDDEN',
  'NO_FACE',
  'CAMERA_OFF',
]);

const RISK_STYLE = {
  LOW: 'bg-green-50 text-green-900 dark:bg-green-900/30 dark:text-green-100',
  MEDIUM: 'bg-amber-50 text-amber-900 dark:bg-amber-900/30 dark:text-amber-100',
  HIGH: 'bg-destructive/10 text-destructive',
} as const;

/** Detail text for an event (warning message, reason, dispute note, object seen…). */
export function eventDetail(event: ProctorEventView, t: ReturnType<typeof useTranslations<'Exam'>>): string | null {
  const data = event.data;
  if (event.kind === 'WARNING' && typeof data.code === 'string') return t(`autoWarning.${data.code}` as 'autoWarning.TAB_HIDDEN');
  if (event.kind === 'PROHIBITED_OBJECT' && typeof data.object === 'string') return data.object === 'book' ? t('object.book') : t('object.phone');
  for (const key of ['message', 'reason', 'note'] as const) {
    if (typeof data[key] === 'string' && data[key]) return data[key] as string;
  }
  return null;
}

/** Integrity score, warnings, the proctor's review and the timeline of one sitting. */
export function IntegrityReportView({ report, onSnapshot }: { report: ExamReport; onSnapshot?: (eventId: string) => void }) {
  const t = useTranslations('Exam');
  const tEvent = useTranslations('Proctor.event');
  const format = useFormatter();
  const events = report.events.filter((e) => !QUIET.has(e.kind));
  const ReviewIcon = report.review.status === 'CLEARED' ? ShieldCheck : report.review.status === 'FLAGGED' ? ShieldAlert : ShieldQuestion;

  return (
    <div className="flex flex-col gap-4">
      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div className="rounded-xl border border-border p-3">
          <dt className="text-xs text-muted-foreground">{t('integrity.score')}</dt>
          <dd className="text-2xl font-semibold tabular-nums">
            {report.integrity.score}
            <span className="text-sm font-normal text-muted-foreground">/100</span>
          </dd>
          <dd className={`mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-medium ${RISK_STYLE[report.integrity.risk]}`}>
            {t(`integrity.risk.${report.integrity.risk}`)}
          </dd>
        </div>
        <div className="rounded-xl border border-border p-3">
          <dt className="text-xs text-muted-foreground">{t('integrity.warnings')}</dt>
          <dd className="text-2xl font-semibold tabular-nums">
            {report.warningCount}
            {report.maxWarnings > 0 ? <span className="text-sm font-normal text-muted-foreground">/{report.maxWarnings}</span> : null}
          </dd>
        </div>
        <div className="rounded-xl border border-border p-3">
          <dt className="text-xs text-muted-foreground">{t('integrity.alerts')}</dt>
          <dd className="text-2xl font-semibold tabular-nums">{report.alertCount}</dd>
        </div>
        <div className="rounded-xl border border-border p-3">
          <dt className="text-xs text-muted-foreground">{t('integrity.review')}</dt>
          <dd className="flex items-center gap-1.5 pt-1 font-medium">
            <ReviewIcon aria-hidden className={`size-5 ${report.review.status === 'FLAGGED' ? 'text-destructive' : report.review.status === 'CLEARED' ? 'text-success' : 'text-muted-foreground'}`} />
            {t(`integrity.reviewStatus.${report.review.status}`)}
          </dd>
        </div>
      </dl>

      {report.review.status !== 'PENDING' ? (
        <p className="rounded-xl bg-muted p-3 text-sm">
          {report.review.note ? <span className="block">“{report.review.note}”</span> : null}
          <span className="block text-xs text-muted-foreground">
            {t('integrity.reviewedBy', {
              name: report.review.reviewer ?? '—',
              at: report.review.at ? format.dateTime(new Date(report.review.at), { dateStyle: 'medium', timeStyle: 'short' }) : '',
            })}
          </span>
        </p>
      ) : (
        <p className="text-sm text-muted-foreground">{t('integrity.pendingHint')}</p>
      )}

      <div>
        <h4 className="mb-2 text-sm font-semibold">{t('integrity.timeline')}</h4>
        <ol className="flex flex-col gap-1.5">
          {events.map((event) => {
            const detail = eventDetail(event, t);
            return (
              <li key={event.id} className={`flex items-start gap-3 rounded-lg px-3 py-2 text-sm ${SERIOUS.has(event.kind) ? 'bg-destructive/10' : 'bg-muted/60'}`}>
                <time className="w-16 shrink-0 tabular-nums text-muted-foreground" dateTime={event.at}>
                  {format.dateTime(new Date(event.at), { timeStyle: 'short' })}
                </time>
                <span className="min-w-0 flex-1">
                  <span className="font-medium">{tEvent(event.kind)}</span>
                  {detail ? <span className="block text-xs opacity-80">{detail}</span> : null}
                </span>
                {event.snapshot && onSnapshot ? (
                  <button type="button" onClick={() => onSnapshot(event.id)} className="flex items-center gap-1 rounded-md border border-border px-2 py-0.5 text-xs hover:border-primary">
                    <ImageIcon aria-hidden className="size-3.5" />
                    {t('integrity.viewSnapshot')}
                  </button>
                ) : null}
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}

/** The learner's own integrity summary on the finished-exam screen. */
export function ExamIntegritySummary({ sessionId }: { sessionId: string }) {
  const t = useTranslations('Exam');
  const [report, setReport] = useState<ExamReport | null>(null);
  useEffect(() => {
    let cancelled = false;
    // The sitting may have just ended; give the server a moment to settle it.
    const timer = window.setTimeout(() => {
      api('GET', `learn/exam-sessions/${sessionId}/report`)
        .then((raw) => !cancelled && setReport(ExamReportSchema.parse(raw)))
        .catch(() => undefined);
    }, 500);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [sessionId]);
  if (!report) return null;
  return (
    <details className="rounded-2xl border border-border p-4" open={report.review.status !== 'PENDING'}>
      <summary className="cursor-pointer font-semibold">{t('integrity.title')}</summary>
      <div className="mt-4">
        <IntegrityReportView report={report} />
      </div>
    </details>
  );
}
