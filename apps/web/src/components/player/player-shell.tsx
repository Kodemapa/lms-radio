'use client';

import { type PlayerOutline } from '@obgyn/types';
import { Dialog, DialogTitle, DialogTrigger, Progress, SheetContent } from '@obgyn/ui';
import { ArrowLeft, ListTree } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState, type ReactNode } from 'react';
import { Link } from '@/i18n/navigation';
import { WishlistButton } from '../course/wishlist-button';
import { CertificateCard } from './certificate-card';
import { CurriculumNav } from './curriculum-nav';

export function PlayerShell({ outline, children }: { outline: PlayerOutline; children: ReactNode }) {
  const t = useTranslations('Player');
  const tCommon = useTranslations('Common');
  const [open, setOpen] = useState(false);
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
    <div className="flex h-dvh flex-col overflow-hidden bg-section">
      <header className="z-20 flex shrink-0 items-center gap-3 border-b border-border bg-secondary px-4 py-3 text-secondary-foreground">
        <Link href={`/courses/${course.slug}`} className="flex items-center gap-1.5 rounded-md p-1.5 text-sm hover:bg-white/10" aria-label={t('backToCourse')}>
          <ArrowLeft aria-hidden className="size-5 rtl:rotate-180" />
          <span className="hidden sm:inline">{t('backToCourse')}</span>
        </Link>
        <span aria-hidden className="h-6 w-px bg-white/20" />
        <p className="min-w-0 flex-1 truncate font-semibold">{course.title}</p>
        <span className="hidden text-sm opacity-80 md:inline">{t('progress', { percent: progress.percent })}</span>
        <WishlistButton courseId={course.id} initial={outline.wishlisted} variant="dark" className="px-2.5 py-1.5" />
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger className="rounded-md p-2 hover:bg-white/10 lg:hidden" aria-label={t('openMenu')}>
            <ListTree aria-hidden className="size-5" />
          </DialogTrigger>
          <SheetContent side="right" closeLabel={tCommon('close')} aria-describedby={undefined}>
            <DialogTitle className="text-lg font-semibold">{t('curriculum')}</DialogTitle>
            {sidebar(() => setOpen(false))}
          </SheetContent>
        </Dialog>
      </header>
      {/* Each column scrolls on its own: browsing chapters never moves the video. */}
      <div className="flex min-h-0 flex-1">
        <main id="main" className="min-w-0 flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">{children}</main>
        <aside className="hidden w-80 shrink-0 flex-col border-l border-border bg-card lg:flex xl:w-96">
          <h2 className="shrink-0 border-b border-border px-4 py-3 font-semibold">{t('curriculum')}</h2>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4">{sidebar()}</div>
        </aside>
      </div>
    </div>
  );
}
