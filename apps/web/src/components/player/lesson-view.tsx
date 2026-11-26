'use client';

import { type PlayerLessonDetail } from '@obgyn/types';
import { Button, Skeleton, toast } from '@obgyn/ui';
import { ArrowLeft, ArrowRight, CheckCircle2, SkipForward } from 'lucide-react';
import { useTranslations } from 'next-intl';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Link } from '@/i18n/navigation';
import { api } from '@/lib/instructor-api';
import { AssignmentLesson } from './assignment-lesson';
import { PdfLesson } from './pdf-lesson';
import { ExamLesson } from './exam-lesson';
import { QuizLesson } from './quiz-lesson';
import { LessonResources, ResourcePanelProvider } from './resources';
import { VideoLesson } from './video-lesson';

// Cornerstone + dcmjs are megabytes; only DICOM lessons should pay for them.
const ImagingLesson = dynamic(() => import('./imaging-lesson').then((m) => m.ImagingLesson), {
  ssr: false,
  loading: () => <Skeleton className="aspect-video w-full rounded-2xl" />,
});

const SELF_COMPLETE = new Set(['VIDEO', 'PDF', 'SIMULATOR', 'LIVE_CLASS']);
/** A video counts as watched at 90%. */
const WATCHED = 0.9;

export function LessonView({ lesson }: { lesson: PlayerLessonDetail }) {
  const t = useTranslations('Player');
  const tCommon = useTranslations('Common');
  const router = useRouter();
  const [completed, setCompleted] = useState(lesson.progress.completed);
  const [checkpointsDone, setCheckpointsDone] = useState(lesson.unlockedUntilSec === null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);
  const autoCompleted = useRef(lesson.progress.completed);
  const slug = lesson.course.slug;

  const save = async (body: { positionSec?: number; completed?: boolean; opened?: boolean }) => {
    if (!lesson.enrolled) return;
    await api('PUT', `learn/lessons/${lesson.id}/progress`, body);
  };

  // Count a view each time the lesson is opened (for progress reports).
  // The ref survives React's development double-mount, so a view counts once.
  const counted = useRef<string | null>(null);
  useEffect(() => {
    if (!lesson.enrolled || counted.current === lesson.id) return;
    counted.current = lesson.id;
    void api('PUT', `learn/lessons/${lesson.id}/progress`, { opened: true }).catch(() => undefined);
  }, [lesson.id, lesson.enrolled]);

  const setDone = async (done: boolean) => {
    setPending(true);
    setError(false);
    try {
      await save({ completed: done });
      setCompleted(done);
      toast.success(t(done ? 'toastCompleted' : 'toastNotCompleted'));
      router.refresh();
    } catch {
      setError(true);
    } finally {
      setPending(false);
    }
  };

  const skip = async () => {
    setPending(true);
    try {
      await api('POST', `learn/lessons/${lesson.id}/skip`);
      toast.info(t('toastSkipped'));
      router.refresh();
    } catch {
      setError(true);
    } finally {
      setPending(false);
    }
  };

  let body: React.ReactNode;
  if (lesson.kind === 'VIDEO' && lesson.media) {
    body = (
      <VideoLesson
        lesson={{ ...lesson, media: lesson.media }}
        onProgress={(positionSec, durationSec, ended, allPassed) => {
          setCheckpointsDone(allPassed);
          const watched = ended || positionSec >= durationSec * WATCHED;
          if (watched && allPassed && !autoCompleted.current) {
            autoCompleted.current = true;
            void save({ positionSec, completed: true })
              .then(() => {
                setCompleted(true);
                router.refresh();
              })
              .catch(() => {
                autoCompleted.current = false;
              });
          } else {
            void save({ positionSec }).catch(() => undefined);
          }
        }}
      />
    );
  } else if (lesson.kind === 'PDF' && lesson.media) {
    body = <PdfLesson assetId={lesson.media.assetId} title={lesson.title} />;
  } else if (lesson.kind === 'QUIZ' && lesson.quiz && lesson.exam) {
    body = <ExamLesson lesson={lesson} quiz={lesson.quiz} exam={lesson.exam} />;
  } else if (lesson.kind === 'QUIZ' && lesson.quiz) {
    body = <QuizLesson lessonId={lesson.id} quiz={lesson.quiz} enrolled={lesson.enrolled} />;
  } else if (lesson.kind === 'IMAGING' && lesson.imaging) {
    body = <ImagingLesson lessonId={lesson.id} title={lesson.title} imaging={lesson.imaging} enrolled={lesson.enrolled} />;
  } else if (lesson.kind === 'ASSIGNMENT' && lesson.assignment) {
    body = <AssignmentLesson lessonId={lesson.id} assignment={lesson.assignment} enrolled={lesson.enrolled} />;
  } else {
    body = (
      <p className="rounded-lg border border-dashed border-border bg-card p-10 text-center text-muted-foreground">
        {lesson.kind === 'VIDEO' || lesson.kind === 'PDF' ? t('noMedia') : t('comingSoon')}
      </p>
    );
  }

  return (
    <ResourcePanelProvider resources={lesson.resources}>
    <article className="mx-auto flex max-w-5xl flex-col gap-5">
      {!lesson.enrolled && lesson.isPreview ? (
        <p role="status" className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-primary-light p-3 text-sm text-primary">
          {t('previewNotice')}
          <Link href={`/courses/${slug}`} className="font-medium underline">{t('enrollCta')}</Link>
        </p>
      ) : null}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">{lesson.title}</h1>
        {completed ? (
          <span className="flex items-center gap-1.5 text-sm font-medium text-success">
            <CheckCircle2 aria-hidden className="size-5" />
            {lesson.progress.skipped ? t('skipped') : t('completed')}
          </span>
        ) : null}
      </div>
      {body}
      {lesson.description ? <p className="whitespace-pre-line text-muted-foreground">{lesson.description}</p> : null}
      <LessonResources />

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-5">
        {lesson.prevLessonId ? (
          <Link href={`/learn/${slug}/${lesson.prevLessonId}`} className="flex items-center gap-1.5 rounded-full border border-border bg-card px-4 py-2 text-sm font-medium hover:border-primary">
            <ArrowLeft aria-hidden className="size-4 rtl:rotate-180" />
            {t('previous')}
          </Link>
        ) : (
          <span />
        )}
        <div className="flex flex-wrap items-center gap-2">
          {lesson.enrolled && SELF_COMPLETE.has(lesson.kind) ? (
            <Button
              variant={completed ? 'outline' : 'default'}
              disabled={pending || (lesson.kind === 'VIDEO' && !checkpointsDone && !completed)}
              title={lesson.kind === 'VIDEO' && !checkpointsDone ? t('answerFirst') : undefined}
              onClick={() => setDone(!completed)}
            >
              {completed ? t('markIncomplete') : t('markComplete')}
            </Button>
          ) : null}
          {lesson.enrolled && lesson.skippable && !completed ? (
            <Button variant="ghost" disabled={pending} onClick={skip}>
              <SkipForward aria-hidden className="size-4" />
              {t('skip')}
            </Button>
          ) : null}
          {lesson.nextLessonId ? (
            <Link href={`/learn/${slug}/${lesson.nextLessonId}`} className="flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary-hover">
              {t('next')}
              <ArrowRight aria-hidden className="size-4 rtl:rotate-180" />
            </Link>
          ) : null}
        </div>
      </div>
      {error ? <p role="alert" className="text-sm text-destructive">{tCommon('genericError')}</p> : null}
    </article>
    </ResourcePanelProvider>
  );
}
