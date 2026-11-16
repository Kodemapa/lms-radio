'use client';

import { type PlayerOutline } from '@obgyn/types';
import { CheckCircle2, ChevronDown, Circle, ClipboardCheck, ClipboardList, FileText, HelpCircle, Lock, PlayCircle, ScanLine, SkipForward } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import { prefetchCornerstone } from '@/components/imaging/cornerstone';
import { Link, usePathname } from '@/i18n/navigation';
import { formatClock } from '@/lib/format';

const KIND_ICON = { VIDEO: PlayCircle, PDF: FileText, QUIZ: HelpCircle, ASSIGNMENT: ClipboardList, IMAGING: ScanLine } as const;

export function CurriculumNav({ outline, onNavigate }: { outline: PlayerOutline; onNavigate?: () => void }) {
  const t = useTranslations('Player');
  const pathname = usePathname();
  const nav = useRef<HTMLElement>(null);
  // Keep the current lesson visible in the (independently scrolling) list.
  useEffect(() => {
    nav.current?.querySelector('[aria-current="page"]')?.scrollIntoView({ block: 'nearest' });
  }, [pathname]);
  // Long courses (100+ lessons): only the chapter being studied is rendered.
  // The others stay collapsed until opened, which keeps the list light.
  const lessonHref = (lessonId: string) => `/learn/${outline.course.slug}/${lessonId}`;
  const currentChapterId =
    outline.chapters.find((chapter) => chapter.lessons.some((lesson) => pathname === lessonHref(lesson.id)))?.id ??
    outline.chapters.find((chapter) => chapter.lessons.some((lesson) => lesson.id === outline.resumeLessonId))?.id ??
    outline.chapters[0]?.id;
  const [open, setOpen] = useState<Set<string>>(() => new Set(currentChapterId ? [currentChapterId] : []));
  useEffect(() => {
    if (currentChapterId) setOpen((current) => (current.has(currentChapterId) ? current : new Set(current).add(currentChapterId)));
  }, [currentChapterId]);
  const toggle = (chapterId: string) =>
    setOpen((current) => {
      const next = new Set(current);
      if (!next.delete(chapterId)) next.add(chapterId);
      return next;
    });
  const warmImaging = () => prefetchCornerstone();
  const entranceHref = `/learn/${outline.course.slug}/entrance`;
  return (
    <nav ref={nav} aria-label={t('curriculum')} className="flex flex-col gap-4">
      {outline.entrance ? (
        <section aria-labelledby="ch-entrance">
          <h3 id="ch-entrance" className="mb-1 px-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t('beforeYouStart')}
          </h3>
          <Link
            href={entranceHref}
            onClick={onNavigate}
            aria-current={pathname === entranceHref ? 'page' : undefined}
            className={`flex items-start gap-2.5 rounded-lg px-2 py-2 text-sm transition-colors ${
              pathname === entranceHref ? 'bg-primary-light font-medium text-primary' : 'hover:bg-muted'
            }`}
          >
            <span className="mt-0.5">
              {outline.entrance.passed ? (
                <CheckCircle2 aria-label={t('completed')} className="size-4 text-success" />
              ) : (
                <ClipboardCheck aria-hidden className="size-4 text-primary" />
              )}
            </span>
            <span className="flex-1">
              {t('entranceItem')}
              {!outline.entrance.passed ? (
                <span className="block text-xs text-muted-foreground">{t('entranceHint', { pass: outline.entrance.passPercent })}</span>
              ) : null}
            </span>
          </Link>
        </section>
      ) : null}
      {outline.chapters.map((chapter) => {
        const expanded = open.has(chapter.id);
        const done = chapter.lessons.filter((lesson) => lesson.completed).length;
        return (
        <section key={chapter.id} aria-labelledby={`ch-${chapter.id}`}>
          <h3 id={`ch-${chapter.id}`} className="mb-1">
            <button
              type="button"
              aria-expanded={expanded}
              aria-controls={`ch-list-${chapter.id}`}
              onClick={() => toggle(chapter.id)}
              className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring"
            >
              <span className="flex-1">
                {chapter.position}. {chapter.title}
              </span>
              <span className="shrink-0 font-normal normal-case tracking-normal">
                {done}/{chapter.lessons.length}
              </span>
              <ChevronDown aria-hidden className={`size-4 shrink-0 transition-transform ${expanded ? 'rotate-180' : ''}`} />
            </button>
          </h3>
          {expanded ? (
          <ol id={`ch-list-${chapter.id}`}>
            {chapter.lessons.map((lesson) => {
              const href = `/learn/${outline.course.slug}/${lesson.id}`;
              const active = pathname === href;
              const KindIcon = KIND_ICON[lesson.kind as keyof typeof KIND_ICON] ?? PlayCircle;
              const status = lesson.locked ? (
                <Lock aria-label={t('locked')} className="size-4 shrink-0 text-muted-foreground" />
              ) : lesson.skipped ? (
                <SkipForward aria-label={t('skipped')} className="size-4 shrink-0 text-muted-foreground" />
              ) : lesson.completed ? (
                <CheckCircle2 aria-label={t('completed')} className="size-4 shrink-0 text-success" />
              ) : (
                <Circle aria-hidden className="size-4 shrink-0 text-border" />
              );
              return (
                <li key={lesson.id}>
                  <Link
                    href={href}
                    onClick={onNavigate}
                    {...(lesson.kind === 'IMAGING' && !lesson.locked ? { onMouseEnter: warmImaging, onFocus: warmImaging } : {})}
                    aria-current={active ? 'page' : undefined}
                    className={`flex items-start gap-2.5 rounded-lg px-2 py-2 text-sm transition-colors ${
                      active ? 'bg-primary-light font-medium text-primary' : 'hover:bg-muted'
                    } ${lesson.locked ? 'opacity-60' : ''}`}
                  >
                    <span className="mt-0.5">{status}</span>
                    <span className="flex-1">{lesson.title}</span>
                    <span className="mt-0.5 flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
                      <KindIcon aria-hidden className="size-3.5" />
                      {lesson.durationSec ? formatClock(lesson.durationSec) : null}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ol>
          ) : null}
        </section>
        );
      })}
    </nav>
  );
}
