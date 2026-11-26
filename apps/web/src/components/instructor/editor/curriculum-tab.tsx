'use client';

import {
  type ExamSettings,
  type InstructorChapter,
  type InstructorCourse,
  type InstructorLesson,
  LESSON_DOCUMENT_TYPES,
} from '@obgyn/types';
import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Select,
  Switch,
  Textarea,
  toast,
} from '@obgyn/ui';
import {
  ArrowDown,
  ArrowUp,
  ClipboardList,
  FileText,
  HelpCircle,
  Info,
  ListChecks,
  Pencil,
  PlayCircle,
  Plus,
  ScanLine,
  Trash2,
  Video,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import dynamic from 'next/dynamic';
import { useState, type FormEvent } from 'react';
import { formatClock } from '@/lib/format';
import { Link } from '@/i18n/navigation';
import { courseApi } from '@/lib/instructor-api';
import { ConfirmDialog } from '../confirm-dialog';
import { FileUpload } from './file-upload';
import { QuestionsDialog } from './questions-dialog';

// Cornerstone + dcmjs are megabytes; load them only when a DICOM case is opened.
const ImagingCaseDialog = dynamic(
  () => import('./imaging-case-dialog').then((m) => m.ImagingCaseDialog),
  { ssr: false },
);

type ChapterEdit = { mode: 'add' } | { mode: 'edit'; chapter: InstructorChapter };
type LessonEdit = { mode: 'add'; chapterId: string } | { mode: 'edit'; lesson: InstructorLesson };
type Confirm = { title: string; body: string; run: () => Promise<void> };

function move<T>(items: T[], index: number, delta: -1 | 1): T[] {
  const next = [...items];
  const [item] = next.splice(index, 1);
  next.splice(index + delta, 0, item!);
  return next;
}

export function CurriculumTab({
  course,
  locked,
  onChange,
}: {
  course: InstructorCourse;
  locked: boolean;
  onChange: (course: InstructorCourse) => void;
}) {
  const t = useTranslations('Instructor.editor');
  const tCommon = useTranslations('Common');
  const [chapterEdit, setChapterEdit] = useState<ChapterEdit | null>(null);
  const [lessonEdit, setLessonEdit] = useState<LessonEdit | null>(null);
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  const [questionsFor, setQuestionsFor] = useState<InstructorLesson | null>(null);
  const [caseFor, setCaseFor] = useState<InstructorLesson | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async (fn: () => Promise<InstructorCourse>, success?: string) => {
    setError(null);
    try {
      onChange(await fn());
      if (success) toast.success(success);
    } catch {
      setError(tCommon('genericError'));
      toast.error(tCommon('genericError'));
    }
  };
  const lessons = course.chapters.flatMap((chapter) => chapter.lessons);
  // A course's first video is a free preview by default, so visitors can try the course.
  const firstVideo = !lessons.some((lesson) => lesson.kind === 'VIDEO' || lesson.isPreview);

  return (
    <div className="flex flex-col gap-4">
      <p className="flex items-start gap-2 rounded-xl bg-primary-light p-3 text-sm text-primary">
        <Info aria-hidden className="mt-0.5 size-4 shrink-0" />
        {t('youtubeNote')}
      </p>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}

      {course.chapters.length === 0 ? (
        <p className="soft-wash rounded-3xl p-8 text-center text-muted-foreground">
          {t('noChapters')}
        </p>
      ) : (
        <ol className="flex flex-col gap-4">
          {course.chapters.map((chapter, chapterIndex) => (
            <li key={chapter.id} className="surface">
              <div className="flex flex-wrap items-center gap-2 border-b border-border p-4">
                <span className="flex size-7 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                  {chapter.position}
                </span>
                <h3 className="min-w-0 flex-1 font-semibold">{chapter.title}</h3>
                {!locked ? (
                  <div className="flex items-center gap-1">
                    <IconButton
                      label={t('moveUp')}
                      disabled={chapterIndex === 0}
                      onClick={() =>
                        run(() =>
                          courseApi('POST', `courses/${course.id}/chapters/reorder`, {
                            ids: move(course.chapters, chapterIndex, -1).map((c) => c.id),
                          }),
                        )
                      }
                    >
                      <ArrowUp className="size-4" />
                    </IconButton>
                    <IconButton
                      label={t('moveDown')}
                      disabled={chapterIndex === course.chapters.length - 1}
                      onClick={() =>
                        run(() =>
                          courseApi('POST', `courses/${course.id}/chapters/reorder`, {
                            ids: move(course.chapters, chapterIndex, 1).map((c) => c.id),
                          }),
                        )
                      }
                    >
                      <ArrowDown className="size-4" />
                    </IconButton>
                    <IconButton
                      label={t('editChapter')}
                      onClick={() => setChapterEdit({ mode: 'edit', chapter })}
                    >
                      <Pencil className="size-4" />
                    </IconButton>
                    <IconButton
                      label={t('deleteChapter')}
                      danger
                      onClick={() =>
                        setConfirm({
                          title: t('deleteChapter'),
                          body: t('deleteChapterConfirm', { title: chapter.title }),
                          run: () =>
                            run(
                              () => courseApi('DELETE', `chapters/${chapter.id}`),
                              t('toast.chapterDeleted'),
                            ),
                        })
                      }
                    >
                      <Trash2 className="size-4" />
                    </IconButton>
                  </div>
                ) : null}
              </div>

              {chapter.lessons.length === 0 ? (
                <p className="px-4 py-3 text-sm text-muted-foreground">{t('noLessons')}</p>
              ) : (
                <ol className="divide-y divide-border">
                  {chapter.lessons.map((lesson, lessonIndex) => {
                    const Icon =
                      lesson.kind === 'PDF'
                        ? FileText
                        : lesson.kind === 'QUIZ'
                          ? HelpCircle
                          : lesson.kind === 'ASSIGNMENT'
                            ? ClipboardList
                            : lesson.kind === 'IMAGING'
                              ? ScanLine
                              : PlayCircle;
                    const needsFile = lesson.kind === 'VIDEO' || lesson.kind === 'PDF';
                    return (
                      // Phones: title and details on the first line, buttons on their own line below.
                      <li
                        key={lesson.id}
                        className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:gap-3"
                      >
                        <div className="flex min-w-0 flex-1 items-start gap-3 sm:items-center">
                          <Icon
                            aria-hidden
                            className="mt-0.5 size-5 shrink-0 text-primary sm:mt-0"
                          />
                          <span className="min-w-0 flex-1">
                            <span
                              className="line-clamp-2 font-medium sm:line-clamp-1"
                              title={lesson.title}
                            >
                              {lesson.title}
                            </span>
                            <span className="flex flex-wrap gap-x-3 text-xs text-muted-foreground">
                              <span>{tCommon(`kind.${lesson.kind}`)}</span>
                              {lesson.durationSec ? (
                                <span>{formatClock(lesson.durationSec)}</span>
                              ) : null}
                              {lesson.isPreview ? (
                                <span className="text-primary">{t('isPreview')}</span>
                              ) : null}
                              {lesson.kind === 'QUIZ' ? (
                                <span className={lesson.questionCount ? '' : 'text-destructive'}>
                                  {t('questionCount', { count: lesson.questionCount })}
                                </span>
                              ) : null}
                              {lesson.exam ? (
                                <span className="font-medium text-primary">
                                  {lesson.exam.proctored
                                    ? t('exam.rowProctored', { minutes: lesson.exam.durationMin })
                                    : t('exam.row', { minutes: lesson.exam.durationMin })}
                                </span>
                              ) : null}
                              {lesson.skippable ? <span>{t('skippable')}</span> : null}
                              {lesson.kind === 'PDF' && lesson.allowDownload ? (
                                <span>{t('downloadAllowed')}</span>
                              ) : null}
                              {needsFile ? (
                                lesson.media?.status === 'READY' ? (
                                  <span className="text-success">{t('fileReady')}</span>
                                ) : (
                                  <span className="text-destructive">
                                    {lesson.media ? t('filePending') : t('noFile')}
                                  </span>
                                )
                              ) : null}
                            </span>
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 ps-8 sm:shrink-0 sm:ps-0">
                          {lesson.kind === 'IMAGING' ? (
                            <Button variant="outline" size="sm" onClick={() => setCaseFor(lesson)}>
                              <ScanLine aria-hidden className="size-4" />
                              {t('editCase')}
                            </Button>
                          ) : null}
                          {lesson.exam ? (
                            <Button asChild size="sm">
                              <Link href={`/instructor/exams/${lesson.id}`}>
                                <Video aria-hidden className="size-4" />
                                {t('exam.proctor')}
                              </Link>
                            </Button>
                          ) : null}
                          {lesson.kind === 'QUIZ' || lesson.kind === 'VIDEO' ? (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setQuestionsFor(lesson)}
                            >
                              <ListChecks aria-hidden className="size-4" />
                              {lesson.kind === 'VIDEO'
                                ? t('videoQuestions', { count: lesson.questionCount })
                                : t('manageQuestions', { count: lesson.questionCount })}
                            </Button>
                          ) : null}
                          {!locked ? (
                            <div className="ms-auto flex items-center gap-1 sm:ms-0">
                              <IconButton
                                label={t('moveUp')}
                                disabled={lessonIndex === 0}
                                onClick={() =>
                                  run(() =>
                                    courseApi('POST', `chapters/${chapter.id}/lessons/reorder`, {
                                      ids: move(chapter.lessons, lessonIndex, -1).map((l) => l.id),
                                    }),
                                  )
                                }
                              >
                                <ArrowUp className="size-4" />
                              </IconButton>
                              <IconButton
                                label={t('moveDown')}
                                disabled={lessonIndex === chapter.lessons.length - 1}
                                onClick={() =>
                                  run(() =>
                                    courseApi('POST', `chapters/${chapter.id}/lessons/reorder`, {
                                      ids: move(chapter.lessons, lessonIndex, 1).map((l) => l.id),
                                    }),
                                  )
                                }
                              >
                                <ArrowDown className="size-4" />
                              </IconButton>
                              <IconButton
                                label={t('editLesson')}
                                onClick={() => setLessonEdit({ mode: 'edit', lesson })}
                              >
                                <Pencil className="size-4" />
                              </IconButton>
                              <IconButton
                                label={t('deleteLesson')}
                                danger
                                onClick={() =>
                                  setConfirm({
                                    title: t('deleteLesson'),
                                    body: t('deleteLessonConfirm', { title: lesson.title }),
                                    run: () =>
                                      run(
                                        () => courseApi('DELETE', `lessons/${lesson.id}`),
                                        t('toast.lessonDeleted'),
                                      ),
                                  })
                                }
                              >
                                <Trash2 className="size-4" />
                              </IconButton>
                            </div>
                          ) : null}
                        </div>
                      </li>
                    );
                  })}
                </ol>
              )}
              {!locked ? (
                <div className="border-t border-border p-3">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setLessonEdit({ mode: 'add', chapterId: chapter.id })}
                  >
                    <Plus aria-hidden className="size-4" />
                    {t('addLesson')}
                  </Button>
                </div>
              ) : null}
            </li>
          ))}
        </ol>
      )}

      {!locked ? (
        <Button variant="outline" className="w-fit" onClick={() => setChapterEdit({ mode: 'add' })}>
          <Plus aria-hidden className="size-4" />
          {t('addChapter')}
        </Button>
      ) : null}

      {chapterEdit ? (
        <ChapterDialog
          edit={chapterEdit}
          onClose={() => setChapterEdit(null)}
          onSave={async (values) => {
            await run(
              () =>
                chapterEdit.mode === 'add'
                  ? courseApi('POST', `courses/${course.id}/chapters`, values)
                  : courseApi('PATCH', `chapters/${chapterEdit.chapter.id}`, values),
              t(chapterEdit.mode === 'add' ? 'toast.chapterAdded' : 'toast.chapterSaved'),
            );
            setChapterEdit(null);
          }}
        />
      ) : null}
      {lessonEdit ? (
        <LessonDialog
          edit={lessonEdit}
          firstVideo={firstVideo}
          onClose={() => setLessonEdit(null)}
          onSave={async (values) => {
            const updated =
              lessonEdit.mode === 'add'
                ? await courseApi('POST', `chapters/${lessonEdit.chapterId}/lessons`, values)
                : await courseApi('PATCH', `lessons/${lessonEdit.lesson.id}`, values);
            onChange(updated);
            toast.success(t(lessonEdit.mode === 'add' ? 'toast.lessonAdded' : 'toast.lessonSaved'));
            setLessonEdit(null);
          }}
        />
      ) : null}
      {caseFor ? (
        <ImagingCaseDialog
          courseId={course.id}
          lessonId={caseFor.id}
          lessonTitle={caseFor.title}
          locked={locked}
          onClose={async () => {
            setCaseFor(null);
            await run(() => courseApi('GET', `courses/${course.id}`));
          }}
        />
      ) : null}
      {questionsFor ? (
        <QuestionsDialog
          lessonId={questionsFor.id}
          lessonTitle={questionsFor.title}
          locked={locked}
          video={questionsFor.kind === 'VIDEO'}
          courseId={course.id}
          mediaAssetId={questionsFor.media?.status === 'READY' ? questionsFor.mediaAssetId : null}
          onClose={async () => {
            setQuestionsFor(null);
            await run(() => courseApi('GET', `courses/${course.id}`));
          }}
        />
      ) : null}
      {confirm ? (
        <ConfirmDialog
          open
          onOpenChange={(open) => !open && setConfirm(null)}
          title={confirm.title}
          body={confirm.body}
          confirmLabel={tCommon('delete')}
          onConfirm={confirm.run}
        />
      ) : null}
    </div>
  );
}

function IconButton({
  label,
  onClick,
  disabled,
  danger,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={`rounded-md p-2 text-muted-foreground transition-colors hover:bg-muted disabled:opacity-30 ${
        danger ? 'hover:text-destructive' : 'hover:text-primary'
      }`}
    >
      {children}
    </button>
  );
}

function ChapterDialog({
  edit,
  onClose,
  onSave,
}: {
  edit: ChapterEdit;
  onClose: () => void;
  onSave: (values: { title: string; description: string | null }) => Promise<void>;
}) {
  const t = useTranslations('Instructor.editor');
  const tCommon = useTranslations('Common');
  const [title, setTitle] = useState(edit.mode === 'edit' ? edit.chapter.title : '');
  const [description, setDescription] = useState(
    edit.mode === 'edit' ? (edit.chapter.description ?? '') : '',
  );
  const [pending, setPending] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!title.trim()) return;
    setPending(true);
    await onSave({ title: title.trim(), description: description.trim() || null });
    setPending(false);
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        keepOpenOnOutsideClick
        closeLabel={tCommon('close')}
        aria-describedby={undefined}
      >
        <form onSubmit={submit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>{edit.mode === 'add' ? t('addChapter') : t('editChapter')}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <Label htmlFor="chapter-title" required>
              {t('chapterTitle')}
            </Label>
            <Input
              id="chapter-title"
              value={title}
              maxLength={150}
              autoFocus
              required
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="chapter-description">{t('chapterDescription')}</Label>
            <Textarea
              id="chapter-description"
              rows={3}
              maxLength={1000}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              {tCommon('cancel')}
            </Button>
            <Button type="submit" disabled={pending || !title.trim()}>
              {pending ? tCommon('saving') : tCommon('save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

interface LessonValues {
  title: string;
  description: string | null;
  kind: 'VIDEO' | 'PDF' | 'QUIZ' | 'ASSIGNMENT' | 'IMAGING';
  isPreview: boolean;
  mediaAssetId: string | null;
  skippable: boolean;
  /** PDF: learners may download a copy stamped with their name and ID. */
  allowDownload: boolean;
  passPercent: number | null;
  instructions: string | null;
  points: number | null;
  submissionKinds: ('IMAGE' | 'PDF')[];
  /** QUIZ: timed / proctored exam; null = practice quiz. */
  exam: ExamSettings | null;
}

/** ISO date-time ↔ the value of an <input type="datetime-local"> (the browser's time zone). */
function toLocalInput(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function fromLocalInput(value: string): string | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

const NEW_EXAM: ExamSettings = {
  opensAt: null,
  closesAt: null,
  durationMin: 30,
  proctored: true,
  aiMonitoring: true,
  autoWarn: false,
  maxWarnings: 3,
};

function LessonDialog({
  edit,
  firstVideo,
  onClose,
  onSave,
}: {
  edit: LessonEdit;
  /** The course has no video or preview lesson yet: a new video starts as a free preview. */
  firstVideo: boolean;
  onClose: () => void;
  onSave: (values: LessonValues) => Promise<void>;
}) {
  const t = useTranslations('Instructor.editor');
  const tCommon = useTranslations('Common');
  const existing = edit.mode === 'edit' ? edit.lesson : null;
  const [values, setValues] = useState<LessonValues>({
    title: existing?.title ?? '',
    description: existing?.description ?? null,
    kind:
      (['VIDEO', 'PDF', 'QUIZ', 'ASSIGNMENT', 'IMAGING'] as const).find(
        (k) => k === existing?.kind,
      ) ?? 'VIDEO',
    isPreview: existing?.isPreview ?? firstVideo,
    mediaAssetId: existing?.mediaAssetId ?? null,
    skippable: existing?.skippable ?? false,
    allowDownload: existing?.allowDownload ?? false,
    passPercent: existing?.passPercent ?? 60,
    instructions: existing?.instructions ?? null,
    points: existing?.points ?? null,
    submissionKinds: existing?.submissionKinds ?? ['PDF'],
    exam: existing?.exam ?? null,
  });
  const [fileName, setFileName] = useState(existing?.media?.originalName ?? null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (patch: Partial<LessonValues>) => setValues((current) => ({ ...current, ...patch }));
  const usesFile = values.kind === 'VIDEO' || values.kind === 'PDF';
  const gated = values.kind === 'QUIZ' || values.kind === 'ASSIGNMENT' || values.kind === 'IMAGING';

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!values.title.trim()) return;
    setPending(true);
    setError(null);
    try {
      await onSave({
        ...values,
        title: values.title.trim(),
        description: values.description?.trim() || null,
      });
    } catch (e) {
      setError((e as { messageText?: string }).messageText ?? tCommon('genericError'));
    } finally {
      setPending(false);
    }
  };

  const toggleKind = (kind: 'IMAGE' | 'PDF', on: boolean) =>
    set({
      submissionKinds: on
        ? [...new Set([...values.submissionKinds, kind])]
        : values.submissionKinds.filter((k) => k !== kind),
    });

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        keepOpenOnOutsideClick
        className="max-w-xl"
        closeLabel={tCommon('close')}
        aria-describedby={undefined}
      >
        <form onSubmit={submit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>{edit.mode === 'add' ? t('addLesson') : t('editLesson')}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <Label htmlFor="lesson-title" required>
              {t('lessonTitle')}
            </Label>
            <Input
              id="lesson-title"
              value={values.title}
              maxLength={150}
              autoFocus
              required
              onChange={(e) => set({ title: e.target.value })}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="lesson-kind" required>
              {t('lessonType')}
            </Label>
            <Select
              id="lesson-kind"
              aria-required="true"
              value={values.kind}
              disabled={
                edit.mode === 'edit' &&
                existing?.kind === 'QUIZ' &&
                (existing?.questionCount ?? 0) > 0
              }
              onChange={(e) => {
                set({ kind: e.target.value as LessonValues['kind'], mediaAssetId: null });
                setFileName(null);
              }}
            >
              <option value="VIDEO">{tCommon('kind.VIDEO')}</option>
              <option value="PDF">{tCommon('kind.PDF')}</option>
              <option value="QUIZ">{tCommon('kind.QUIZ')}</option>
              <option value="ASSIGNMENT">{tCommon('kind.ASSIGNMENT')}</option>
              <option value="IMAGING">{tCommon('kind.IMAGING')}</option>
            </Select>
          </div>

          {usesFile ? (
            <FileUpload
              key={values.kind}
              kind={values.kind as 'VIDEO' | 'PDF'}
              // Lesson documents open in the protected PDF viewer, so PDF only.
              accept={values.kind === 'PDF' ? [...LESSON_DOCUMENT_TYPES] : undefined}
              hint={values.kind === 'PDF' ? t('pdfLessonHint') : undefined}
              label={t('lessonFile')}
              currentName={fileName}
              onUploaded={({ assetId, fileName: name }) => {
                set({ mediaAssetId: assetId });
                setFileName(name);
              }}
            />
          ) : null}

          {values.kind === 'QUIZ' || values.kind === 'IMAGING' ? (
            <div className="flex flex-col gap-2">
              <Label htmlFor="lesson-pass">{t('passPercent')}</Label>
              <Input
                id="lesson-pass"
                type="number"
                min={0}
                max={100}
                className="w-32"
                value={values.passPercent ?? ''}
                onChange={(e) =>
                  set({
                    passPercent:
                      e.target.value === ''
                        ? null
                        : Math.min(100, Math.max(0, Number(e.target.value))),
                  })
                }
              />
              {edit.mode === 'add' ? (
                <p className="text-xs text-muted-foreground">{t('saveLessonFirst')}</p>
              ) : null}
            </div>
          ) : null}

          {values.kind === 'QUIZ' ? (
            <fieldset className="flex flex-col gap-4 rounded-xl border border-border p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <Label htmlFor="lesson-exam">{t('exam.enable')}</Label>
                  <p id="lesson-exam-hint" className="text-sm text-muted-foreground">
                    {t('exam.enableHint')}
                  </p>
                </div>
                <Switch
                  id="lesson-exam"
                  checked={!!values.exam}
                  onCheckedChange={(on) => set({ exam: on ? (values.exam ?? NEW_EXAM) : null })}
                  aria-describedby="lesson-exam-hint"
                />
              </div>
              {values.exam ? (
                <>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="exam-opens">{t('exam.opensAt')}</Label>
                      <Input
                        id="exam-opens"
                        type="datetime-local"
                        value={toLocalInput(values.exam.opensAt)}
                        onChange={(e) =>
                          set({
                            exam: { ...values.exam!, opensAt: fromLocalInput(e.target.value) },
                          })
                        }
                      />
                    </div>
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="exam-closes">{t('exam.closesAt')}</Label>
                      <Input
                        id="exam-closes"
                        type="datetime-local"
                        value={toLocalInput(values.exam.closesAt)}
                        onChange={(e) =>
                          set({
                            exam: { ...values.exam!, closesAt: fromLocalInput(e.target.value) },
                          })
                        }
                      />
                    </div>
                  </div>
                  <p className="-mt-2 text-xs text-muted-foreground">{t('exam.windowHint')}</p>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="exam-duration" required>
                      {t('exam.duration')}
                    </Label>
                    <Input
                      id="exam-duration"
                      type="number"
                      min={1}
                      max={600}
                      className="w-32"
                      value={values.exam.durationMin}
                      onChange={(e) =>
                        set({
                          exam: {
                            ...values.exam!,
                            durationMin: Math.min(600, Math.max(1, Number(e.target.value) || 1)),
                          },
                        })
                      }
                    />
                  </div>
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <Label htmlFor="exam-proctored">{t('exam.proctored')}</Label>
                      <p id="exam-proctored-hint" className="text-sm text-muted-foreground">
                        {t('exam.proctoredHint')}
                      </p>
                    </div>
                    <Switch
                      id="exam-proctored"
                      checked={values.exam.proctored}
                      onCheckedChange={(on) => set({ exam: { ...values.exam!, proctored: on } })}
                      aria-describedby="exam-proctored-hint"
                    />
                  </div>
                  {values.exam.proctored ? (
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <Label htmlFor="exam-ai">{t('exam.aiMonitoring')}</Label>
                        <p id="exam-ai-hint" className="text-sm text-muted-foreground">
                          {t('exam.aiMonitoringHint')}
                        </p>
                      </div>
                      <Switch
                        id="exam-ai"
                        checked={values.exam.aiMonitoring}
                        onCheckedChange={(on) =>
                          set({ exam: { ...values.exam!, aiMonitoring: on } })
                        }
                        aria-describedby="exam-ai-hint"
                      />
                    </div>
                  ) : null}
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <Label htmlFor="exam-autowarn">{t('exam.autoWarn')}</Label>
                      <p id="exam-autowarn-hint" className="text-sm text-muted-foreground">
                        {t('exam.autoWarnHint')}
                      </p>
                    </div>
                    <Switch
                      id="exam-autowarn"
                      checked={values.exam.autoWarn}
                      onCheckedChange={(on) => set({ exam: { ...values.exam!, autoWarn: on } })}
                      aria-describedby="exam-autowarn-hint"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="exam-max-warnings">{t('exam.maxWarnings')}</Label>
                    <Input
                      id="exam-max-warnings"
                      type="number"
                      min={0}
                      max={10}
                      className="w-32"
                      value={values.exam.maxWarnings}
                      aria-describedby="exam-max-warnings-hint"
                      onChange={(e) =>
                        set({
                          exam: {
                            ...values.exam!,
                            maxWarnings: Math.min(
                              10,
                              Math.max(0, Math.floor(Number(e.target.value) || 0)),
                            ),
                          },
                        })
                      }
                    />
                    <p id="exam-max-warnings-hint" className="text-xs text-muted-foreground">
                      {t('exam.maxWarningsHint')}
                    </p>
                  </div>
                </>
              ) : null}
            </fieldset>
          ) : null}

          {values.kind === 'ASSIGNMENT' ? (
            <>
              <div className="flex flex-col gap-2">
                <Label htmlFor="lesson-instructions">{t('instructions')}</Label>
                <Textarea
                  id="lesson-instructions"
                  rows={5}
                  maxLength={10000}
                  value={values.instructions ?? ''}
                  onChange={(e) => set({ instructions: e.target.value })}
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="lesson-points">{t('points')}</Label>
                  <Input
                    id="lesson-points"
                    type="number"
                    min={0}
                    max={1000}
                    value={values.points ?? ''}
                    onChange={(e) =>
                      set({ points: e.target.value === '' ? null : Number(e.target.value) })
                    }
                  />
                </div>
                <fieldset className="flex flex-col gap-2">
                  <legend className="mb-1 text-sm font-medium">{t('submissionKinds')}</legend>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      className="size-4 accent-[var(--primary)]"
                      checked={values.submissionKinds.includes('PDF')}
                      onChange={(e) => toggleKind('PDF', e.target.checked)}
                    />
                    {t('kindPdf')}
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      className="size-4 accent-[var(--primary)]"
                      checked={values.submissionKinds.includes('IMAGE')}
                      onChange={(e) => toggleKind('IMAGE', e.target.checked)}
                    />
                    {t('kindImage')}
                  </label>
                </fieldset>
              </div>
            </>
          ) : null}

          <div className="flex flex-col gap-2">
            <Label htmlFor="lesson-description">{t('lessonDescription')}</Label>
            <Textarea
              id="lesson-description"
              rows={3}
              maxLength={2000}
              value={values.description ?? ''}
              onChange={(e) => set({ description: e.target.value })}
            />
          </div>
          {values.kind === 'PDF' ? (
            <div className="flex items-start justify-between gap-4">
              <div>
                <Label htmlFor="lesson-download">{t('allowDownload')}</Label>
                <p id="lesson-download-hint" className="text-sm text-muted-foreground">
                  {t('allowDownloadHint')}
                </p>
              </div>
              <Switch
                id="lesson-download"
                checked={values.allowDownload}
                onCheckedChange={(checked) => set({ allowDownload: checked })}
                aria-describedby="lesson-download-hint"
              />
            </div>
          ) : null}
          {gated ? (
            <div className="flex items-start justify-between gap-4">
              <div>
                <Label htmlFor="lesson-skippable">{t('skippable')}</Label>
                <p id="lesson-skippable-hint" className="text-sm text-muted-foreground">
                  {t('skippableHint')}
                </p>
              </div>
              <Switch
                id="lesson-skippable"
                checked={values.skippable}
                onCheckedChange={(checked) => set({ skippable: checked })}
                aria-describedby="lesson-skippable-hint"
              />
            </div>
          ) : null}
          <div className="flex items-start justify-between gap-4">
            <div>
              <Label htmlFor="lesson-preview">{t('isPreview')}</Label>
              <p id="lesson-preview-hint" className="text-sm text-muted-foreground">
                {t('isPreviewHint')}
              </p>
            </div>
            <Switch
              id="lesson-preview"
              checked={values.isPreview}
              onCheckedChange={(checked) => set({ isPreview: checked })}
              aria-describedby="lesson-preview-hint"
            />
          </div>
          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              {tCommon('cancel')}
            </Button>
            <Button type="submit" disabled={pending || !values.title.trim()}>
              {pending ? tCommon('saving') : tCommon('save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
