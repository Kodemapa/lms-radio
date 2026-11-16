'use client';

import { type InstructorChapter, type InstructorCourse, type InstructorLesson } from '@obgyn/types';
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
} from '@obgyn/ui';
import { ArrowDown, ArrowUp, ClipboardList, FileText, HelpCircle, Info, ListChecks, Pencil, PlayCircle, Plus, ScanLine, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState, type FormEvent } from 'react';
import { formatClock } from '@/lib/format';
import { courseApi } from '@/lib/instructor-api';
import { ConfirmDialog } from '../confirm-dialog';
import { FileUpload } from './file-upload';
import { ImagingCaseDialog } from './imaging-case-dialog';
import { QuestionsDialog } from './questions-dialog';

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

  const run = async (fn: () => Promise<InstructorCourse>) => {
    setError(null);
    try {
      onChange(await fn());
    } catch {
      setError(tCommon('genericError'));
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <p className="flex items-start gap-2 rounded-xl bg-primary-light p-3 text-sm text-primary">
        <Info aria-hidden className="mt-0.5 size-4 shrink-0" />
        {t('youtubeNote')}
      </p>
      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}

      {course.chapters.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border bg-card p-8 text-center text-muted-foreground">
          {t('noChapters')}
        </p>
      ) : (
        <ol className="flex flex-col gap-4">
          {course.chapters.map((chapter, chapterIndex) => (
            <li key={chapter.id} className="rounded-2xl border border-border bg-card">
              <div className="flex flex-wrap items-center gap-2 border-b border-border p-4">
                <span className="flex size-7 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                  {chapter.position}
                </span>
                <h3 className="flex-1 font-semibold">{chapter.title}</h3>
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
                    <IconButton label={t('editChapter')} onClick={() => setChapterEdit({ mode: 'edit', chapter })}>
                      <Pencil className="size-4" />
                    </IconButton>
                    <IconButton
                      label={t('deleteChapter')}
                      danger
                      onClick={() =>
                        setConfirm({
                          title: t('deleteChapter'),
                          body: t('deleteChapterConfirm', { title: chapter.title }),
                          run: () => run(() => courseApi('DELETE', `chapters/${chapter.id}`)),
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
                      lesson.kind === 'PDF' ? FileText : lesson.kind === 'QUIZ' ? HelpCircle : lesson.kind === 'ASSIGNMENT' ? ClipboardList : lesson.kind === 'IMAGING' ? ScanLine : PlayCircle;
                    const needsFile = lesson.kind === 'VIDEO' || lesson.kind === 'PDF';
                    return (
                      <li key={lesson.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                        <Icon aria-hidden className="size-5 shrink-0 text-primary" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium">{lesson.title}</span>
                          <span className="flex flex-wrap gap-x-3 text-xs text-muted-foreground">
                            <span>{tCommon(`kind.${lesson.kind}`)}</span>
                            {lesson.durationSec ? <span>{formatClock(lesson.durationSec)}</span> : null}
                            {lesson.isPreview ? <span className="text-primary">{t('isPreview')}</span> : null}
                            {lesson.kind === 'QUIZ' ? (
                              <span className={lesson.questionCount ? '' : 'text-destructive'}>
                                {t('questionCount', { count: lesson.questionCount })}
                              </span>
                            ) : null}
                            {lesson.skippable ? <span>{t('skippable')}</span> : null}
                            {needsFile ? (
                              lesson.media?.status === 'READY' ? (
                                <span className="text-success">{t('fileReady')}</span>
                              ) : (
                                <span className="text-destructive">{lesson.media ? t('filePending') : t('noFile')}</span>
                              )
                            ) : null}
                          </span>
                        </span>
                        {lesson.kind === 'IMAGING' ? (
                          <Button variant="outline" size="sm" onClick={() => setCaseFor(lesson)}>
                            <ScanLine aria-hidden className="size-4" />
                            {t('editCase')}
                          </Button>
                        ) : null}
                        {lesson.kind === 'QUIZ' || lesson.kind === 'VIDEO' ? (
                          <Button variant="outline" size="sm" onClick={() => setQuestionsFor(lesson)}>
                            <ListChecks aria-hidden className="size-4" />
                            {lesson.kind === 'VIDEO'
                              ? t('videoQuestions', { count: lesson.questionCount })
                              : t('manageQuestions', { count: lesson.questionCount })}
                          </Button>
                        ) : null}
                        {!locked ? (
                          <div className="flex items-center gap-1">
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
                            <IconButton label={t('editLesson')} onClick={() => setLessonEdit({ mode: 'edit', lesson })}>
                              <Pencil className="size-4" />
                            </IconButton>
                            <IconButton
                              label={t('deleteLesson')}
                              danger
                              onClick={() =>
                                setConfirm({
                                  title: t('deleteLesson'),
                                  body: t('deleteLessonConfirm', { title: lesson.title }),
                                  run: () => run(() => courseApi('DELETE', `lessons/${lesson.id}`)),
                                })
                              }
                            >
                              <Trash2 className="size-4" />
                            </IconButton>
                          </div>
                        ) : null}
                      </li>
                    );
                  })}
                </ol>
              )}
              {!locked ? (
                <div className="border-t border-border p-3">
                  <Button variant="ghost" size="sm" onClick={() => setLessonEdit({ mode: 'add', chapterId: chapter.id })}>
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
            await run(() =>
              chapterEdit.mode === 'add'
                ? courseApi('POST', `courses/${course.id}/chapters`, values)
                : courseApi('PATCH', `chapters/${chapterEdit.chapter.id}`, values),
            );
            setChapterEdit(null);
          }}
        />
      ) : null}
      {lessonEdit ? (
        <LessonDialog
          edit={lessonEdit}
          onClose={() => setLessonEdit(null)}
          onSave={async (values) => {
            const updated =
              lessonEdit.mode === 'add'
                ? await courseApi('POST', `chapters/${lessonEdit.chapterId}/lessons`, values)
                : await courseApi('PATCH', `lessons/${lessonEdit.lesson.id}`, values);
            onChange(updated);
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
  const [description, setDescription] = useState(edit.mode === 'edit' ? (edit.chapter.description ?? '') : '');
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
      <DialogContent closeLabel={tCommon('close')} aria-describedby={undefined}>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>{edit.mode === 'add' ? t('addChapter') : t('editChapter')}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <Label htmlFor="chapter-title">{t('chapterTitle')}</Label>
            <Input id="chapter-title" value={title} maxLength={150} autoFocus required onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="chapter-description">{t('chapterDescription')}</Label>
            <Textarea id="chapter-description" rows={3} maxLength={1000} value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>{tCommon('cancel')}</Button>
            <Button type="submit" disabled={pending || !title.trim()}>{pending ? tCommon('saving') : tCommon('save')}</Button>
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
  passPercent: number | null;
  instructions: string | null;
  points: number | null;
  submissionKinds: ('IMAGE' | 'PDF')[];
}

function LessonDialog({
  edit,
  onClose,
  onSave,
}: {
  edit: LessonEdit;
  onClose: () => void;
  onSave: (values: LessonValues) => Promise<void>;
}) {
  const t = useTranslations('Instructor.editor');
  const tCommon = useTranslations('Common');
  const existing = edit.mode === 'edit' ? edit.lesson : null;
  const [values, setValues] = useState<LessonValues>({
    title: existing?.title ?? '',
    description: existing?.description ?? null,
    kind: (['VIDEO', 'PDF', 'QUIZ', 'ASSIGNMENT', 'IMAGING'] as const).find((k) => k === existing?.kind) ?? 'VIDEO',
    isPreview: existing?.isPreview ?? false,
    mediaAssetId: existing?.mediaAssetId ?? null,
    skippable: existing?.skippable ?? false,
    passPercent: existing?.passPercent ?? 60,
    instructions: existing?.instructions ?? null,
    points: existing?.points ?? null,
    submissionKinds: existing?.submissionKinds ?? ['PDF'],
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
      await onSave({ ...values, title: values.title.trim(), description: values.description?.trim() || null });
    } catch (e) {
      setError((e as { messageText?: string }).messageText ?? tCommon('genericError'));
    } finally {
      setPending(false);
    }
  };

  const toggleKind = (kind: 'IMAGE' | 'PDF', on: boolean) =>
    set({ submissionKinds: on ? [...new Set([...values.submissionKinds, kind])] : values.submissionKinds.filter((k) => k !== kind) });

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-xl" closeLabel={tCommon('close')} aria-describedby={undefined}>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>{edit.mode === 'add' ? t('addLesson') : t('editLesson')}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <Label htmlFor="lesson-title">{t('lessonTitle')}</Label>
            <Input id="lesson-title" value={values.title} maxLength={150} autoFocus required onChange={(e) => set({ title: e.target.value })} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="lesson-kind">{t('lessonType')}</Label>
            <Select
              id="lesson-kind"
              value={values.kind}
              disabled={edit.mode === 'edit' && (existing?.kind === 'QUIZ') && (existing?.questionCount ?? 0) > 0}
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
              <Input id="lesson-pass" type="number" min={0} max={100} className="w-32" value={values.passPercent ?? ''}
                onChange={(e) => set({ passPercent: e.target.value === '' ? null : Math.min(100, Math.max(0, Number(e.target.value))) })} />
              {edit.mode === 'add' ? <p className="text-xs text-muted-foreground">{t('saveLessonFirst')}</p> : null}
            </div>
          ) : null}

          {values.kind === 'ASSIGNMENT' ? (
            <>
              <div className="flex flex-col gap-2">
                <Label htmlFor="lesson-instructions">{t('instructions')}</Label>
                <Textarea id="lesson-instructions" rows={5} maxLength={10000} value={values.instructions ?? ''} onChange={(e) => set({ instructions: e.target.value })} />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="lesson-points">{t('points')}</Label>
                  <Input id="lesson-points" type="number" min={0} max={1000} value={values.points ?? ''}
                    onChange={(e) => set({ points: e.target.value === '' ? null : Number(e.target.value) })} />
                </div>
                <fieldset className="flex flex-col gap-2">
                  <legend className="mb-1 text-sm font-medium">{t('submissionKinds')}</legend>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" className="size-4 accent-[var(--primary)]" checked={values.submissionKinds.includes('PDF')} onChange={(e) => toggleKind('PDF', e.target.checked)} />
                    {t('kindPdf')}
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" className="size-4 accent-[var(--primary)]" checked={values.submissionKinds.includes('IMAGE')} onChange={(e) => toggleKind('IMAGE', e.target.checked)} />
                    {t('kindImage')}
                  </label>
                </fieldset>
              </div>
            </>
          ) : null}

          <div className="flex flex-col gap-2">
            <Label htmlFor="lesson-description">{t('lessonDescription')}</Label>
            <Textarea id="lesson-description" rows={3} maxLength={2000} value={values.description ?? ''} onChange={(e) => set({ description: e.target.value })} />
          </div>
          {gated ? (
            <div className="flex items-start justify-between gap-4">
              <div>
                <Label htmlFor="lesson-skippable">{t('skippable')}</Label>
                <p id="lesson-skippable-hint" className="text-sm text-muted-foreground">{t('skippableHint')}</p>
              </div>
              <Switch id="lesson-skippable" checked={values.skippable} onCheckedChange={(checked) => set({ skippable: checked })} aria-describedby="lesson-skippable-hint" />
            </div>
          ) : null}
          <div className="flex items-start justify-between gap-4">
            <div>
              <Label htmlFor="lesson-preview">{t('isPreview')}</Label>
              <p id="lesson-preview-hint" className="text-sm text-muted-foreground">{t('isPreviewHint')}</p>
            </div>
            <Switch id="lesson-preview" checked={values.isPreview} onCheckedChange={(checked) => set({ isPreview: checked })} aria-describedby="lesson-preview-hint" />
          </div>
          {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>{tCommon('cancel')}</Button>
            <Button type="submit" disabled={pending || !values.title.trim()}>
              {pending ? tCommon('saving') : tCommon('save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
