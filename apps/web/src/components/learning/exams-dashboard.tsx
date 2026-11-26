'use client';

import { formatCountdown, secondsLeft, type MyExam, type MyExams } from '@obgyn/types';
import {
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  ClipboardList,
  Clock,
  FileBarChart,
  MonitorCheck,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  TriangleAlert,
} from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import { Link } from '@/i18n/navigation';

const GRADIENT_TEXT =
  'bg-[linear-gradient(100deg,#6A52A3_10%,#A85BA6_55%,#DD6C2C_95%)] bg-clip-text text-transparent';
const CARD_SHADOW = 'shadow-[0_30px_60px_-40px_rgba(47,35,64,.35)]';
const PASTELS = [
  'bg-[#EDE3FA] dark:bg-[#2e2545]',
  'bg-[#FBDCC3] dark:bg-[#3a2a22]',
  'bg-[#DDE8DC] dark:bg-[#22302a]',
  'bg-[#F6DFE6] dark:bg-[#3a2530]',
];

const lessonHref = (exam: MyExam) => `/learn/${exam.course.slug}/${exam.lessonId}`;
const isLive = (exam: MyExam) => exam.state === 'LIVE' || exam.state === 'IN_PROGRESS';

/** Ticks every second; `offset` = server clock − this device's clock. */
function useClock(serverNow: string) {
  const offset = useRef(new Date(serverNow).getTime() - Date.now());
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  return { now, offset: offset.current };
}

/** Plum pill button with the orange arrow circle. */
function PrimaryLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex min-h-12 items-center gap-3 rounded-full bg-secondary py-1.5 pl-6 pr-1.5 text-sm font-semibold text-secondary-foreground shadow-[0_12px_24px_-12px_#2F2340] transition-transform hover:-translate-y-px"
    >
      {children}
      <span aria-hidden className="grid size-10 place-items-center rounded-full bg-accent text-[#2F2340]">
        <ArrowUpRight className="size-4" />
      </span>
    </Link>
  );
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-[#B8551A] dark:text-accent">
      <span aria-hidden className="h-0.5 w-5 bg-accent" />
      {children}
    </p>
  );
}

/**
 * The learner's exams on "My learning": a hero for an exam that is live now (with the
 * time left to start it), the live exam cards, how a proctored exam works, and the rest
 * (upcoming, finished with score and review, missed) plus the rules.
 */
export function ExamsDashboard({ data, firstName }: { data: MyExams; firstName: string }) {
  const t = useTranslations('MyExams');
  const format = useFormatter();
  const { now, offset } = useClock(data.serverNow);
  const [greeting, setGreeting] = useState<'morning' | 'afternoon' | 'evening' | null>(null);
  // The learner's own time of day (the server may be in another time zone).
  useEffect(() => {
    const hour = new Date().getHours();
    setGreeting(hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening');
  }, []);

  const exams = data.exams;
  if (exams.length === 0) return null;
  const live = exams.filter(isLive);
  const upcoming = exams.filter((e) => e.state === 'UPCOMING');
  const others = exams.filter((e) => !isLive(e));
  const scores = exams.map((e) => e.scorePercent).filter((s): s is number => s !== null);
  const average = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;
  const focus = live[0] ?? null;
  const maxWarnings = Math.max(0, ...exams.map((e) => e.maxWarnings));
  const dateTime = (iso: string) => format.dateTime(new Date(iso), { dateStyle: 'medium', timeStyle: 'short' });

  // Countdown on the hero: time left in a running sitting, else until the window closes.
  const deadline = focus ? (focus.state === 'IN_PROGRESS' ? focus.endsAt : focus.closesAt) : null;
  const left = deadline ? secondsLeft(deadline, offset, now) : null;

  return (
    <section aria-labelledby="my-exams-title" className="relative flex flex-col gap-8">
      {/* Hero */}
      <div className="grid items-center gap-8 lg:grid-cols-[1.25fr_1fr]">
        <div className="flex flex-col gap-5">
          {focus ? (
            <span className="inline-flex w-fit items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold text-primary">
              <Sparkles aria-hidden className="size-3.5 text-accent" />
              {focus.course.title}
            </span>
          ) : null}
          <h2 id="my-exams-title" className="font-heading text-3xl font-bold leading-[1.08] tracking-tight sm:text-4xl xl:text-5xl">
            {greeting ? t(`greeting.${greeting}`, { name: firstName }) : t('hello', { name: firstName })}
            <span className={`block ${GRADIENT_TEXT}`}>
              {live.length > 0 ? t('liveNow', { count: live.length }) : upcoming.length > 0 ? t('nextUp') : t('allDone')}
            </span>
          </h2>
          <p className="max-w-xl text-muted-foreground">
            {focus?.closesAt && focus.state === 'LIVE'
              ? t('subtitleCloses', { time: format.dateTime(new Date(focus.closesAt), { timeStyle: 'short' }) })
              : t('subtitle')}
          </p>
          <div className="flex flex-wrap items-center gap-5">
            {focus ? (
              <PrimaryLink href={lessonHref(focus)}>
                {focus.state === 'IN_PROGRESS' ? t('resume', { title: focus.title }) : t('start', { title: focus.title })}
              </PrimaryLink>
            ) : upcoming[0] ? (
              <PrimaryLink href={lessonHref(upcoming[0])}>{t('open', { title: upcoming[0].title })}</PrimaryLink>
            ) : null}
            <a href="#exam-rules" className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold hover:text-primary">
              {t('readRules')}
              <ArrowRight aria-hidden className="size-4" />
            </a>
          </div>
          <dl className="flex flex-wrap gap-x-8 gap-y-3">
            {[
              [t('stat.live'), String(live.length)],
              [t('stat.upcoming'), String(upcoming.length)],
              [t('stat.average'), average === null ? '—' : `${average}%`],
            ].map(([label, value], i) => (
              <div key={label} className={`flex flex-col ${i > 0 ? 'border-l border-border pl-8' : ''}`}>
                <dt className="text-sm text-muted-foreground">{label}</dt>
                <dd className="font-heading text-3xl font-bold tabular-nums">{value}</dd>
              </div>
            ))}
          </dl>
        </div>

        {focus ? (
          <div className="relative mx-auto hidden w-full max-w-sm sm:block">
            <div aria-hidden className="pointer-events-none absolute -inset-10 rounded-full border-[1.5px] border-dashed border-[rgba(106,82,163,.2)]" />
            <div className="relative flex flex-col items-center gap-3 rounded-b-[32px] rounded-t-[165px] border-[6px] border-card bg-[linear-gradient(170deg,#DCC8F5_0%,#F2CFE0_50%,#F9D6BE_100%)] px-8 pb-24 pt-16 text-center text-[#2B2036] shadow-xl">
              <span className="grid size-20 place-items-center rounded-3xl bg-white shadow-md">
                <ShieldCheck aria-hidden className="size-9 text-[#6A52A3]" />
              </span>
              <p className="font-heading text-2xl font-bold">{focus.proctored ? t('card.proctored') : t('card.timed')}</p>
              <p className="text-sm text-[#4A3F57]">
                {focus.proctored ? t('card.checkFirst') : t('card.minutes', { minutes: focus.durationMin })}
              </p>
            </div>
            {left !== null ? (
              <div className="absolute -left-4 bottom-8 -rotate-3 rounded-2xl border border-border bg-card px-5 py-3 shadow-lg">
                <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#B8551A] dark:text-accent">
                  {focus.state === 'IN_PROGRESS' ? t('card.timeLeft') : t('card.closesIn')}
                </p>
                <p role="timer" className="font-heading text-3xl font-bold tabular-nums text-[#B42318] dark:text-red-400">
                  {formatCountdown(left)}
                </p>
              </div>
            ) : null}
            {focus.proctored ? (
              <span className="absolute -right-2 top-10 flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold shadow-md">
                <span aria-hidden className="size-2 rounded-full bg-success" />
                {t('card.webcam')}
              </span>
            ) : null}
          </div>
        ) : null}
      </div>

      {/* Live exams */}
      {live.map((exam) => (
        <article key={exam.lessonId} className={`overflow-hidden rounded-[32px] border border-border bg-card ${CARD_SHADOW}`}>
          <div className="flex flex-wrap items-start gap-4 p-5 sm:p-7">
            <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-[#FBDCC3] text-[#B8551A]">
              <ClipboardList aria-hidden className="size-6" />
            </span>
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <div className="flex flex-wrap gap-2 text-xs font-semibold">
                {exam.aiMonitoring ? <span className="rounded-full bg-[#EEE5FA] px-2.5 py-1 text-[#5A4496]">{t('tag.ai')}</span> : null}
                {exam.proctored ? <span className="rounded-full bg-[#FBDCC3] px-2.5 py-1 text-[#9A4512]">{t('tag.liveProctor')}</span> : null}
                <span className="rounded-full bg-[#F6DFE6] px-2.5 py-1 text-[#8A2148]">{t('tag.timed')}</span>
                {exam.proctored ? <span className="rounded-full bg-muted px-2.5 py-1">{t('tag.webcam')}</span> : null}
              </div>
              <h3 className="font-heading text-xl font-bold sm:text-2xl">{exam.title}</h3>
              <p className="text-sm text-muted-foreground">{exam.course.title}</p>
            </div>
            <span className="flex items-center gap-2 rounded-full bg-[#DFF3E6] px-3 py-1.5 text-sm font-semibold text-[#22653F]">
              <span aria-hidden className="size-2 rounded-full bg-[#22653F]" />
              {exam.state === 'IN_PROGRESS' ? t('status.inProgress') : t('status.live')}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-x-8 gap-y-4 bg-[linear-gradient(120deg,#F6F0FD_0%,#FBF1F4_55%,#FEF3EA_100%)] px-5 py-5 dark:bg-muted dark:bg-none sm:px-7">
            <dl className="flex flex-1 flex-wrap gap-x-8 gap-y-3 text-sm">
              {[
                [t('field.opens'), exam.opensAt ? dateTime(exam.opensAt) : t('field.anyTime')],
                [t('field.closes'), exam.closesAt ? dateTime(exam.closesAt) : t('field.noDeadline')],
                [t('field.duration'), t('field.minutes', { minutes: exam.durationMin })],
                [t('field.questions'), String(exam.questionCount)],
              ].map(([label, value], i) => (
                <div key={label} className={i > 0 ? 'sm:border-l sm:border-border sm:pl-8' : ''}>
                  <dt className="text-muted-foreground">{label}</dt>
                  <dd className="font-semibold">{value}</dd>
                </div>
              ))}
            </dl>
            <PrimaryLink href={lessonHref(exam)}>{exam.state === 'IN_PROGRESS' ? t('resumeShort') : t('startShort')}</PrimaryLink>
          </div>
        </article>
      ))}

      {/* How it works */}
      <div className="flex flex-col gap-6 rounded-[32px] bg-[linear-gradient(120deg,#EFE4FB_0%,#F6E6EF_55%,#FDE6D3_100%)] p-6 text-[#2B2036] dark:bg-muted dark:bg-none dark:text-foreground sm:p-10">
        <div className="flex flex-col gap-2">
          <Eyebrow>{t('how.eyebrow')}</Eyebrow>
          <h3 className="font-heading text-2xl font-bold sm:text-3xl">{t('how.title')}</h3>
          <p className="text-sm text-[#4A3F57] dark:text-muted-foreground">{t('how.subtitle')}</p>
        </div>
        <ol className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {(
            [
              ['device', MonitorCheck],
              ['test', Clock],
              ['alerts', ShieldAlert],
              ['report', FileBarChart],
            ] as const
          ).map(([key, Icon]) => (
            <li key={key} className="flex flex-col gap-3">
              <span
                className={`grid size-12 place-items-center rounded-2xl ${
                  key === 'test' ? 'bg-accent text-white shadow-[0_10px_20px_-8px_#EF8746]' : 'bg-white text-[#6A52A3]'
                }`}
              >
                <Icon aria-hidden className="size-5" />
              </span>
              <p className="font-heading text-lg font-bold">{t(`how.${key}.title`)}</p>
              <p className="text-sm text-[#4A3F57] dark:text-muted-foreground">{t(`how.${key}.body`)}</p>
            </li>
          ))}
        </ol>
      </div>

      {/* Everything else */}
      <div className="flex flex-col gap-4">
        <Eyebrow>{t('rest.eyebrow')}</Eyebrow>
        <h3 className="font-heading text-2xl font-bold sm:text-3xl">{t('rest.title')}</h3>
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {others.slice(0, 6).map((exam, i) => (
            <li
              key={exam.lessonId}
              className={`flex flex-col gap-3 rounded-[28px] p-6 text-[#2B2036] dark:text-foreground ${
                exam.state === 'FINISHED' ? PASTELS[2] : exam.state === 'MISSED' ? PASTELS[3] : PASTELS[i % 2]
              }`}
            >
              <div className="flex items-start justify-between">
                <span className="grid size-11 place-items-center rounded-xl bg-white text-[#6A52A3]">
                  {exam.state === 'FINISHED' ? (
                    <ShieldCheck aria-hidden className="size-5" />
                  ) : exam.state === 'MISSED' ? (
                    <TriangleAlert aria-hidden className="size-5" />
                  ) : (
                    <CalendarDays aria-hidden className="size-5" />
                  )}
                </span>
                <span className="text-sm tabular-nums text-[#4A3F57] dark:text-muted-foreground">{String(i + 1).padStart(2, '0')}</span>
              </div>
              <p className="font-heading text-xl font-bold leading-snug">{exam.title}</p>
              <p className="text-sm text-[#4A3F57] dark:text-muted-foreground">{exam.course.title}</p>
              {exam.state === 'FINISHED' ? (
                <>
                  <p className="text-sm">
                    {exam.review === 'CLEARED'
                      ? t('review.cleared')
                      : exam.review === 'FLAGGED'
                        ? t('review.flagged')
                        : t('review.pending')}
                  </p>
                  <p className="font-heading text-4xl font-bold text-[#22653F] dark:text-green-300">
                    {exam.scorePercent === null ? '—' : `${exam.scorePercent}%`}
                  </p>
                </>
              ) : exam.state === 'UPCOMING' ? (
                <p className="font-heading text-lg font-bold">
                  {exam.opensAt ? dateTime(exam.opensAt) : t('field.anyTime')}
                  <span className="block text-sm font-normal text-[#4A3F57] dark:text-muted-foreground">
                    {t('field.minutes', { minutes: exam.durationMin })} · {t('questions', { count: exam.questionCount })}
                  </span>
                </p>
              ) : (
                <p className="text-sm">{t('missed')}</p>
              )}
              <div className="mt-auto flex items-center justify-between gap-2 pt-2">
                <span className="text-sm font-semibold">
                  {exam.state === 'FINISHED' ? t('viewResult') : exam.state === 'UPCOMING' ? t('opensSoon') : t('closedLabel')}
                </span>
                <Link
                  href={lessonHref(exam)}
                  aria-label={t('openExam', { title: exam.title })}
                  className="grid size-10 place-items-center rounded-full bg-secondary text-secondary-foreground"
                >
                  <ArrowUpRight aria-hidden className="size-4" />
                </Link>
              </div>
            </li>
          ))}
          <li id="exam-rules" className={`flex scroll-mt-24 flex-col gap-3 rounded-[28px] p-6 text-[#2B2036] dark:text-foreground ${PASTELS[3]}`}>
            <span className="grid size-11 place-items-center rounded-xl bg-white text-[#B42318]">
              <TriangleAlert aria-hidden className="size-5" />
            </span>
            <p className="font-heading text-xl font-bold">{t('rules.title')}</p>
            <ul className="flex flex-col gap-2 text-sm">
              {[t('rules.fullscreen'), t('rules.face'), t('rules.noPhones'), ...(maxWarnings > 0 ? [t('rules.warnings', { count: maxWarnings })] : [])].map(
                (rule) => (
                  <li key={rule} className="flex gap-2">
                    <span aria-hidden className="text-accent">✦</span>
                    {rule}
                  </li>
                ),
              )}
            </ul>
          </li>
        </ul>
      </div>
    </section>
  );
}
