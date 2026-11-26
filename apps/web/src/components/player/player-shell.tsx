'use client';

import { type PlayerOutline } from '@obgyn/types';
import { Dialog, DialogTitle, DialogTrigger, Progress, SheetContent } from '@obgyn/ui';
import { ArrowLeft, ListTree } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useMemo, useState, type ReactNode } from 'react';
import { Link } from '@/i18n/navigation';
import { WishlistButton } from '../course/wishlist-button';
import { CertificateCard } from './certificate-card';
import { CurriculumNav } from './curriculum-nav';
import { ExamSidebarProvider } from './exam-sidebar';

/**
 * Course player: the same light header as the rest of the site (logo, notifications,
 * theme, language, account), plus the course's own controls, then lesson + curriculum.
 */
export function PlayerShell({
  outline,
  children,
  brand,
  account,
}: {
  outline: PlayerOutline;
  children: ReactNode;
  /** Logo link home (server-rendered). */
  brand: ReactNode;
  /** Notifications, theme, language and account menu (server-rendered). */
  account: ReactNode;
}) {
  const t = useTranslations('Player');
  const tCommon = useTranslations('Common');
  const [open, setOpen] = useState(false);
  // A running exam shows its question grid in the right column instead of the course content.
  const [examSlot, setExamSlot] = useState<HTMLDivElement | null>(null);
  const [examActive, setExamActive] = useState(false);
  const examSidebar = useMemo(() => ({ target: examSlot, setActive: setExamActive }), [examSlot]);
  const { progress, course } = outline;
  const complete = progress.total > 0 && progress.completed === progress.total;

  const sidebar = (onNavigate?: () => void) => (
    <div className="flex flex-col gap-5">
      <div className={outline.enrolled ? 'flex flex-col gap-2' : 'hidden'}>
        <p className="text-sm font-medium">{t('progress', { percent: progress.percent })}</p>
        <Progress value={progress.percent} aria-label={t('progress', { percent: progress.percent })} />
        <p className="text-xs text-muted-foreground">{t('lessonsDone', { done: progress.completed, total: progress.total })}</p>
      </div>
      {course.certificateEnabled && outline.enrolled ? (
        <CertificateCard
          slug={course.slug}
          complete={complete}
          serial={outline.certificateSerial}
          hasFee={(course.certificateFeePaise ?? 0) > 0}
        />
      ) : null}
      <CurriculumNav outline={outline} onNavigate={onNavigate} />
    </div>
  );

  return (
    <div className="page-glow flex h-dvh flex-col overflow-hidden bg-background">
      <header className="site-header shrink-0">
        <div className="flex h-[68px] items-center gap-2 px-3 sm:gap-3 lg:px-6">
          <span className="hidden md:flex">{brand}</span>
          <span aria-hidden className="hidden h-7 w-px bg-border md:block" />
          <Link
            href={`/courses/${course.slug}`}
            className="flex shrink-0 items-center gap-1.5 rounded-full border border-border bg-card px-3 py-2 text-sm font-medium transition-colors hover:border-primary/40 hover:text-primary"
            aria-label={t('backToCourse')}
          >
            <ArrowLeft aria-hidden className="size-4 rtl:rotate-180" />
            <span className="hidden sm:inline">{t('backToCourse')}</span>
          </Link>
          <p className="min-w-0 flex-1 truncate font-semibold">{course.title}</p>
          {outline.enrolled ? (
            <span className="hidden shrink-0 rounded-full bg-primary-light px-3 py-1.5 text-sm font-semibold text-primary xl:inline">
              {t('progress', { percent: progress.percent })}
            </span>
          ) : null}
          <WishlistButton courseId={course.id} initial={outline.wishlisted} variant="labelled" className="hidden shrink-0 px-3 lg:flex" />
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger
              className="flex size-10 shrink-0 items-center justify-center rounded-full border border-border bg-card transition-colors hover:border-primary/40 hover:text-primary lg:hidden"
              aria-label={t('openMenu')}
            >
              <ListTree aria-hidden className="size-4" />
            </DialogTrigger>
            <SheetContent side="right" closeLabel={tCommon('close')} aria-describedby={undefined}>
              <DialogTitle className="text-lg font-semibold">{t('curriculum')}</DialogTitle>
              {sidebar(() => setOpen(false))}
            </SheetContent>
          </Dialog>
          <div className="flex shrink-0 items-center gap-2">{account}</div>
        </div>
      </header>
      {/* Each column scrolls on its own: browsing chapters never moves the video. */}
      <div className="flex min-h-0 flex-1">
        <main id="main" className="min-w-0 flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
          <ExamSidebarProvider value={examSidebar}>{children}</ExamSidebarProvider>
        </main>
        <aside className="surface my-3 me-3 hidden w-80 shrink-0 flex-col overflow-hidden lg:flex xl:w-96">
          {examActive ? null : <h2 className="shrink-0 border-b border-border/70 px-5 py-4 font-semibold">{t('curriculum')}</h2>}
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4">
            <div ref={setExamSlot} />
            {examActive ? null : sidebar()}
          </div>
        </aside>
      </div>
    </div>
  );
}
