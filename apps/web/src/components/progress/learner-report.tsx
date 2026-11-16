import { type LearnerReport, type LessonReport, type MasteryLevel, type TopicMastery } from '@obgyn/types';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  Circle,
  CircleDashed,
  Clock3,
  Flag,
  HelpCircle,
  MapPin,
  MinusCircle,
  PlayCircle,
  Target,
  TrendingUp,
} from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { type ReactNode } from 'react';
import { Meter } from '@/components/charts/day-bars';
import { Link } from '@/i18n/navigation';
import { formatClock, formatDuration } from '@/lib/format';

/** Watch time: seconds under a minute, otherwise "1h 5m" / "12m" (never rounds 0 up). */
const watchTime = (sec: number) => (sec < 60 ? `${sec}s` : formatDuration(sec));

const LEVEL_STYLE: Record<MasteryLevel, { badge: string; bar: string; Icon: typeof CheckCircle2 }> = {
  STRONG: { badge: 'bg-success/15 text-success', bar: 'bg-success', Icon: CheckCircle2 },
  DEVELOPING: { badge: 'bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-100', bar: 'bg-amber-500', Icon: TrendingUp },
  NEEDS_WORK: { badge: 'bg-destructive/10 text-destructive', bar: 'bg-destructive', Icon: AlertTriangle },
  NOT_ENOUGH_DATA: { badge: 'bg-muted text-muted-foreground', bar: 'bg-muted-foreground/40', Icon: HelpCircle },
};

function LevelBadge({ level }: { level: MasteryLevel }) {
  const t = useTranslations('Report');
  const { badge, Icon } = LEVEL_STYLE[level];
  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${badge}`}>
      <Icon aria-hidden className="size-3.5" />
      {t(`level.${level}`)}
    </span>
  );
}

function Stat({ icon, label, value, detail }: { icon: ReactNode; label: string; value: ReactNode; detail?: ReactNode }) {
  return (
    <div className="flex flex-col gap-1 rounded-2xl border border-border bg-card p-4">
      <span className="flex items-center gap-2 text-sm text-muted-foreground">
        {icon}
        {label}
      </span>
      <span className="text-2xl font-semibold tabular-nums">{value}</span>
      {detail ? <span className="text-xs text-muted-foreground">{detail}</span> : null}
    </div>
  );
}

/**
 * A learner's progress in one course: where they are, strengths and
 * weaknesses per topic, and every lesson's tries. Shown to the learner
 * ("you") and to the course team ("they") with the same numbers.
 */
export function LearnerReportView({ report, audience }: { report: LearnerReport; audience: 'learner' | 'instructor' }) {
  const t = useTranslations('Report');
  const locale = useLocale();
  const { overview } = report;
  const date = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' }) : '—');
  const lessonHref = (id: string) => `/learn/${report.course.slug}/${id}` as const;
  const judged = report.topics.filter((topic) => topic.level !== 'NOT_ENOUGH_DATA' && topic.topicId);
  const strong = judged.filter((topic) => topic.level === 'STRONG');
  const weak = judged.filter((topic) => topic.level === 'NEEDS_WORK');
  const developing = judged.filter((topic) => topic.level === 'DEVELOPING');
  const nextChapter = report.chapters.find((c) => c.lessons.some((l) => l.id === overview.nextLesson?.id))?.id;
  const you = audience === 'learner';

  return (
    <div className="flex flex-col gap-8">
      {/* Where they are */}
      <section aria-labelledby="report-where" className="flex flex-col gap-4">
        <h2 id="report-where" className="sr-only">{t('overviewTitle')}</h2>
        <div className="grid gap-4 rounded-2xl border border-border bg-card p-5 md:grid-cols-[1fr_1fr]">
          <div className="flex flex-col gap-2">
            <span className="text-sm text-muted-foreground">{t('progress')}</span>
            <Meter percent={overview.percent} label={t('progress')} />
            <span className="text-sm">{t('lessonsDone', { done: overview.completedLessons, total: overview.totalLessons })}</span>
            <span className="text-xs text-muted-foreground">
              {t('enrolledOn', { date: date(overview.enrolledAt) })} · {t('lastActive', { date: date(overview.lastActivityAt) })}
            </span>
          </div>
          <div className="flex flex-col gap-3">
            <div className="flex items-start gap-2">
              <MapPin aria-hidden className="mt-0.5 size-4 shrink-0 text-primary" />
              <div className="min-w-0">
                <span className="block text-sm text-muted-foreground">{you ? t('youWereOn') : t('theyWereOn')}</span>
                {overview.lastLesson ? (
                  <span className="block font-medium">
                    {overview.lastLesson.title}
                    <span className="block text-xs font-normal text-muted-foreground">{overview.lastLesson.chapterTitle}</span>
                  </span>
                ) : (
                  <span className="block font-medium">{t('notStartedYet')}</span>
                )}
              </div>
            </div>
            <div className="flex items-start gap-2">
              <Flag aria-hidden className="mt-0.5 size-4 shrink-0 text-primary" />
              <div className="min-w-0">
                <span className="block text-sm text-muted-foreground">{t('nextUp')}</span>
                {overview.nextLesson ? (
                  you ? (
                    <Link href={lessonHref(overview.nextLesson.id)} className="font-medium text-primary hover:underline">
                      {overview.nextLesson.title}
                    </Link>
                  ) : (
                    <span className="font-medium">{overview.nextLesson.title}</span>
                  )
                ) : (
                  <span className="font-medium text-success">{t('allDone')}</span>
                )}
              </div>
            </div>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Stat icon={<Clock3 aria-hidden className="size-4" />} label={t('watchTime')} value={watchTime(overview.watchedSec)} detail={t('watchTimeHelp')} />
          <Stat
            icon={<Target aria-hidden className="size-4" />}
            label={t('quizAverage')}
            value={overview.averageQuizScore === null ? '—' : `${overview.averageQuizScore}%`}
            detail={t('quizAttempts', { count: overview.quizAttempts })}
          />
          <Stat
            icon={<PlayCircle aria-hidden className="size-4" />}
            label={t('videoQuestions')}
            value={overview.checkpointFirstTryPercent === null ? '—' : `${overview.checkpointFirstTryPercent}%`}
            detail={t('firstTryHelp', { count: overview.checkpointTries })}
          />
          {overview.entrance ? (
            <Stat
              icon={<Flag aria-hidden className="size-4" />}
              label={t('entrance')}
              value={overview.entrance.passed ? t('passed') : overview.entrance.attempts ? t('notPassed') : '—'}
              detail={t('entranceDetail', { count: overview.entrance.attempts, score: overview.entrance.lastScore ?? 0 })}
            />
          ) : null}
        </div>
      </section>

      {/* Strengths and weaknesses */}
      <section aria-labelledby="report-topics" className="flex flex-col gap-4">
        <div>
          <h2 id="report-topics" className="text-xl font-semibold">{t('topicsTitle')}</h2>
          <p className="text-sm text-muted-foreground">{t('topicsHelp')}</p>
        </div>
        {judged.length ? (
          <div className="grid gap-3 md:grid-cols-3">
            <TopicGroup title={you ? t('youAreStrong') : t('theyAreStrong')} topics={strong} level="STRONG" empty={t('noneYet')} />
            <TopicGroup title={t('developing')} topics={developing} level="DEVELOPING" empty={t('noneYet')} />
            <TopicGroup title={t('needsWork')} topics={weak} level="NEEDS_WORK" empty={t('noneWeak')} />
          </div>
        ) : (
          <p className="rounded-2xl border border-dashed border-border bg-card p-6 text-center text-sm text-muted-foreground">
            {you ? t('noTopicDataYou') : t('noTopicData')}
          </p>
        )}
        {report.topics.length ? (
          <div className="overflow-x-auto rounded-2xl border border-border bg-card">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">{t('topicsTitle')}</caption>
              <thead className="bg-muted/60 text-xs uppercase text-muted-foreground">
                <tr>
                  <th scope="col" className="px-4 py-2">{t('topic')}</th>
                  <th scope="col" className="px-4 py-2">{t('score')}</th>
                  <th scope="col" className="px-4 py-2">{t('answered')}</th>
                  <th scope="col" className="px-4 py-2">{t('level.title')}</th>
                </tr>
              </thead>
              <tbody>
                {report.topics.map((topic) => (
                  <tr key={topic.topicId ?? 'none'} className="border-t border-border">
                    <th scope="row" className="px-4 py-2.5 font-medium">{topic.name ?? t('untagged')}</th>
                    <td className="px-4 py-2.5">
                      {topic.answered ? (
                        <span className="flex items-center gap-2">
                          <span className="h-2 w-24 overflow-hidden rounded-full bg-muted" aria-hidden>
                            <span className={`block h-full rounded-full ${LEVEL_STYLE[topic.level].bar}`} style={{ width: `${topic.percent}%` }} />
                          </span>
                          <span className="tabular-nums">{topic.percent}%</span>
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">
                      {topic.answered ? (
                        <>
                          <span className="tabular-nums text-foreground">{t('correctOf', { correct: topic.correct, answered: topic.answered })}</span>
                          <span className="block text-xs">{sources(topic, t)}</span>
                        </>
                      ) : (
                        t('notAttempted')
                      )}
                    </td>
                    <td className="px-4 py-2.5"><LevelBadge level={topic.level} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>

      {/* Lesson by lesson */}
      <section aria-labelledby="report-lessons" className="flex flex-col gap-3">
        <div>
          <h2 id="report-lessons" className="text-xl font-semibold">{t('lessonsTitle')}</h2>
          <p className="text-sm text-muted-foreground">{t('lessonsHelp')}</p>
        </div>
        {report.chapters.map((chapter) => (
          <details key={chapter.id} open={chapter.id === nextChapter} className="group rounded-2xl border border-border bg-card">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-4 [&::-webkit-details-marker]:hidden">
              <span className="min-w-0 font-medium">{chapter.title}</span>
              <span className="flex shrink-0 items-center gap-3 text-sm text-muted-foreground">
                <span className="tabular-nums">{t('lessonsDone', { done: chapter.completed, total: chapter.total })}</span>
                <ChevronDown aria-hidden className="size-4 transition-transform group-open:rotate-180" />
              </span>
            </summary>
            <ul className="divide-y divide-border border-t border-border">
              {chapter.lessons.map((lesson) => (
                <LessonRow key={lesson.id} lesson={lesson} href={you ? lessonHref(lesson.id) : null} isNext={lesson.id === overview.nextLesson?.id} />
              ))}
            </ul>
          </details>
        ))}
      </section>
    </div>
  );
}

function sources(topic: TopicMastery, t: ReturnType<typeof useTranslations<'Report'>>): string {
  return (['QUIZ', 'VIDEO', 'ENTRANCE'] as const)
    .filter((s) => topic.bySource[s] > 0)
    .map((s) => t(`source.${s}`, { count: topic.bySource[s] }))
    .join(' · ');
}

function TopicGroup({ title, topics, level, empty }: { title: string; topics: TopicMastery[]; level: MasteryLevel; empty: string }) {
  const { Icon } = LEVEL_STYLE[level];
  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-4">
      <h3 className="flex items-center gap-2 text-sm font-semibold">
        <Icon aria-hidden className={`size-4 ${level === 'STRONG' ? 'text-success' : level === 'NEEDS_WORK' ? 'text-destructive' : 'text-amber-600'}`} />
        {title}
      </h3>
      {topics.length ? (
        <ul className="flex flex-wrap gap-1.5">
          {topics.map((topic) => (
            <li key={topic.topicId} className={`rounded-full px-2.5 py-1 text-xs font-medium ${LEVEL_STYLE[level].badge}`}>
              {topic.name} · {topic.percent}%
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-muted-foreground">{empty}</p>
      )}
    </div>
  );
}

function StatusIcon({ status }: { status: LessonReport['status'] }) {
  if (status === 'COMPLETED') return <CheckCircle2 aria-hidden className="size-5 shrink-0 text-success" />;
  if (status === 'SKIPPED') return <MinusCircle aria-hidden className="size-5 shrink-0 text-muted-foreground" />;
  if (status === 'IN_PROGRESS') return <CircleDashed aria-hidden className="size-5 shrink-0 text-primary" />;
  return <Circle aria-hidden className="size-5 shrink-0 text-muted-foreground/50" />;
}

function LessonRow({ lesson, href, isNext }: { lesson: LessonReport; href: string | null; isNext: boolean }) {
  const t = useTranslations('Report');
  const facts: ReactNode[] = [];
  if (lesson.video) {
    const { durationSec, watchedSec, furthestSec } = lesson.video;
    facts.push(
      durationSec
        ? t('videoWatched', { watched: watchTime(watchedSec), total: formatClock(durationSec), reached: formatClock(furthestSec) })
        : t('videoWatchedNoTotal', { watched: watchTime(watchedSec) }),
    );
  }
  if (lesson.views) facts.push(t('opened', { count: lesson.views }));
  const graded = lesson.quiz ?? lesson.imaging;

  return (
    <li className={`flex flex-col gap-2 px-4 py-3 ${isNext ? 'bg-primary-light/50' : ''}`}>
      <div className="flex items-start gap-3">
        <StatusIcon status={lesson.status} />
        <div className="min-w-0 flex-1">
          <p className="font-medium">
            {href ? (
              <Link href={href} className="hover:text-primary hover:underline">{lesson.title}</Link>
            ) : (
              lesson.title
            )}
            {isNext ? <span className="ms-2 rounded-full bg-primary px-2 py-0.5 text-xs font-medium text-primary-foreground">{t('nextUp')}</span> : null}
          </p>
          <p className="text-xs text-muted-foreground">
            {t(`kind.${lesson.kind}`)} · {t(`status.${lesson.status}`)}
            {facts.length ? <> · {facts.map((f, i) => <span key={i}>{i ? ' · ' : ''}{f}</span>)}</> : null}
          </p>
        </div>
        {graded && graded.attempts ? (
          <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${graded.passed ? 'bg-success/15 text-success' : 'bg-destructive/10 text-destructive'}`}>
            {graded.passed ? t('passed') : t('notPassed')}
          </span>
        ) : null}
      </div>

      {graded ? (
        <div className="ms-8 text-sm">
          {graded.attempts ? (
            <>
              <p>
                {t('attemptsSummary', { count: graded.attempts, best: graded.bestScore ?? 0, last: graded.lastScore ?? 0, pass: graded.passPercent })}
              </p>
              <ol className="mt-1 flex flex-wrap items-center gap-1 text-xs" aria-label={t('attemptHistory')}>
                {graded.history.map((h, i) => (
                  <li key={h.at} className="flex items-center gap-1">
                    {i ? <span aria-hidden className="text-muted-foreground">→</span> : null}
                    <span className={`rounded px-1.5 py-0.5 tabular-nums ${h.passed ? 'bg-success/15 text-success' : 'bg-muted'}`}>{h.scorePercent}%</span>
                  </li>
                ))}
              </ol>
            </>
          ) : (
            <p className="text-muted-foreground">{t('noAttempts')}</p>
          )}
        </div>
      ) : null}

      {lesson.checkpoints ? (
        <details className="ms-8 text-sm">
          <summary className="cursor-pointer text-primary">
            {t('checkpointSummary', {
              total: lesson.checkpoints.total,
              passed: lesson.checkpoints.passed,
              tries: lesson.checkpoints.attempts,
              firstTry: lesson.checkpoints.firstTry,
            })}
          </summary>
          <ul className="mt-2 flex flex-col gap-1.5">
            {lesson.checkpoints.questions.map((q) => (
              <li key={q.id} className="flex items-start gap-2">
                <span className="w-12 shrink-0 font-mono text-xs text-muted-foreground">{formatClock(q.atSec)}</span>
                <span className="min-w-0 flex-1">
                  {q.text}
                  {q.topic ? <span className="ms-2 rounded-full bg-primary-light px-2 py-0.5 text-xs text-primary">{q.topic}</span> : null}
                </span>
                <span className="shrink-0 text-xs">
                  {q.attempts === 0 ? (
                    <span className="text-muted-foreground">{t('notAnswered')}</span>
                  ) : q.passed ? (
                    <span className={q.attempts === 1 ? 'text-success' : 'text-amber-700 dark:text-amber-300'}>{t('triesToCorrect', { count: q.attempts })}</span>
                  ) : (
                    <span className="text-destructive">{t('triesNotYet', { count: q.attempts })}</span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </details>
      ) : null}

      {lesson.assignment ? (
        <p className="ms-8 text-sm text-muted-foreground">{t(`assignment.${lesson.assignment.status}`)}</p>
      ) : null}
    </li>
  );
}
