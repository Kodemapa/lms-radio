'use client';

import { InstructorQuestionSchema, QuestionInputSchema, type InstructorQuestion } from '@obgyn/types';
import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Select,
  Switch,
  Textarea,
  toast,
} from '@obgyn/ui';
import { CheckCircle2, Crosshair, Library, MapPin, Pencil, Plus, Trash2, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { z } from 'zod';
import { api } from '@/lib/instructor-api';
import { ProtectedPlayer, type PlayerApi } from '../../protected-player';
import { BankPicker } from './bank-picker';
import { useTopics } from './topics';
import { ConfirmDialog } from '../confirm-dialog';

type Draft = { at: string; topicId: string; text: string; explanation: string; allowMultiple: boolean; options: { text: string; isCorrect: boolean }[] };
const EMPTY: Draft = {
  at: '',
  topicId: '',
  text: '',
  explanation: '',
  allowMultiple: false,
  options: [
    { text: '', isCorrect: true },
    { text: '', isCorrect: false },
  ],
};
const parse = (data: unknown) => z.array(InstructorQuestionSchema).parse(data);

/** "1:30" or "90" → 90 seconds; null if invalid. */
export function parseClock(value: string): number | null {
  const trimmed = value.trim();
  const match = /^(?:(\d+):)?(\d{1,2}|\d+)$/.exec(trimmed);
  if (!match) return null;
  const minutes = match[1] ? Number(match[1]) : 0;
  const seconds = Number(match[2]);
  if (match[1] && seconds > 59) return null;
  return minutes * 60 + seconds;
}
const clock = (sec: number) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;

export function QuestionsDialog({
  lessonId,
  lessonTitle,
  locked,
  onClose,
  video = false,
  mediaAssetId = null,
  courseId,
}: {
  lessonId: string;
  lessonTitle: string;
  locked: boolean;
  onClose: () => void;
  /** In-video questions: each needs a time. */
  video?: boolean;
  /** The lesson's video, so questions can be placed by pausing it. */
  mediaAssetId?: string | null;
  /** For picking questions from the course question bank. */
  courseId: string;
}) {
  const t = useTranslations('Instructor.editor');
  const tCommon = useTranslations('Common');
  const [questions, setQuestions] = useState<InstructorQuestion[] | null>(null);
  const { topics } = useTopics(courseId);
  const [editing, setEditing] = useState<{ id: string | null; draft: Draft } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [picking, setPicking] = useState<{ atSec: number | null } | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const player = useRef<PlayerApi>(null);
  const [now, setNow] = useState(0);
  const nowClock = clock(Math.floor(now));
  const showPlayer = video && !!mediaAssetId;

  const edit = (question: InstructorQuestion) =>
    setEditing({
      id: question.id,
      draft: {
        at: question.atSec !== null ? clock(question.atSec) : '',
        topicId: question.topicId ?? '',
        text: question.text,
        explanation: question.explanation ?? '',
        allowMultiple: question.allowMultiple,
        options: question.options.map(({ text, isCorrect }) => ({ text, isCorrect })),
      },
    });

  /** Pause and start a new question at the current video time. */
  const addHere = () => {
    player.current?.pause();
    setError(null);
    setEditing({ id: null, draft: { ...EMPTY, at: clock(Math.floor(player.current?.currentTime() ?? now)) } });
  };

  useEffect(() => {
    api('GET', `instructor/lessons/${lessonId}/questions`)
      .then((data) => setQuestions(parse(data)))
      .catch(() => setError(tCommon('genericError')));
  }, [lessonId, tCommon]);

  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (!editing) return;
    const atSec = video ? parseClock(editing.draft.at) : null;
    if (video && atSec === null) return setError(t('atTimeInvalid'));
    const input = {
      atSec,
      topicId: editing.draft.topicId || null,
      text: editing.draft.text,
      explanation: editing.draft.explanation.trim() || null,
      allowMultiple: editing.draft.allowMultiple,
      options: editing.draft.options.filter((o) => o.text.trim()),
    };
    const parsed = QuestionInputSchema.safeParse(input);
    if (!parsed.success) return setError(parsed.error.issues[0]?.message ?? tCommon('genericError'));
    setPending(true);
    setError(null);
    try {
      const data = editing.id
        ? await api('PATCH', `instructor/questions/${editing.id}`, parsed.data)
        : await api('POST', `instructor/lessons/${lessonId}/questions`, parsed.data);
      setQuestions(parse(data));
      toast.success(tCommon(editing.id ? 'toast.saved' : 'toast.questionAdded'));
      setEditing(null);
    } catch {
      setError(tCommon('genericError'));
    } finally {
      setPending(false);
    }
  };

  const setOption = (index: number, patch: Partial<Draft['options'][number]>) =>
    setEditing((current) => {
      if (!current) return current;
      let options = current.draft.options.map((o, i) => (i === index ? { ...o, ...patch } : o));
      // Single-answer questions: picking one correct option clears the others.
      if (patch.isCorrect && !current.draft.allowMultiple) {
        options = options.map((o, i) => ({ ...o, isCorrect: i === index }));
      }
      return { ...current, draft: { ...current.draft, options } };
    });

  return (
    <>
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent keepOpenOnOutsideClick className={showPlayer ? 'max-w-4xl' : 'max-w-2xl'} closeLabel={tCommon('close')} aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>{video ? t('videoQuestionsTitle', { title: lessonTitle }) : t('questionsTitle', { title: lessonTitle })}</DialogTitle>
        </DialogHeader>
        {showPlayer ? (
          <div className="flex flex-col gap-2">
            <ProtectedPlayer
              assetId={mediaAssetId!}
              title={lessonTitle}
              apiRef={player}
              onTimeChange={setNow}
              markers={(questions ?? []).filter((q) => q.atSec !== null).map((q) => ({ atSec: q.atSec!, passed: false }))}
              onMarkerSelect={(atSec) => {
                const question = questions?.find((q) => q.atSec === atSec);
                if (question && !locked) {
                  player.current?.pause();
                  edit(question);
                }
              }}
            />
            {!locked ? (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-muted-foreground">{t('placeHint')}</p>
                {!editing && !picking ? (
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" onClick={() => {
                      player.current?.pause();
                      setPicking({ atSec: Math.floor(player.current?.currentTime() ?? now) });
                    }}>
                      <Library aria-hidden className="size-4" />
                      {t('fromBank.button')}
                    </Button>
                    <Button onClick={addHere}>
                      <MapPin aria-hidden className="size-4" />
                      {t('addQuestionAt', { time: nowClock })}
                    </Button>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : video ? (
          <p className="rounded-lg bg-muted p-3 text-sm text-muted-foreground">{t('uploadVideoFirst')}</p>
        ) : null}

        {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}

        {picking ? (
          <BankPicker
            courseId={courseId}
            single={video}
            atLabel={picking.atSec !== null ? clock(picking.atSec) : undefined}
            usedIds={new Set((questions ?? []).map((q) => q.bankQuestionId).filter((id): id is string => !!id))}
            onCancel={() => setPicking(null)}
            onAdd={async (ids) => {
              try {
                setQuestions(parse(await api('POST', `instructor/lessons/${lessonId}/questions/from-bank`, { bankQuestionIds: ids, atSec: video ? picking.atSec : null })));
                toast.success(tCommon('toast.questionAdded'));
                setPicking(null);
              } catch (e) {
                setError((e as { messageText?: string }).messageText ?? tCommon('genericError'));
              }
            }}
          />
        ) : editing ? (
          <form onSubmit={save} className="flex flex-col gap-4">
            {video ? (
              <div className="flex flex-col gap-2">
                <Label htmlFor="q-at">{t('atTime')}</Label>
                <div className="flex flex-wrap items-center gap-2">
                  <Input id="q-at" className="w-32" inputMode="numeric" placeholder="1:30" value={editing.draft.at} aria-describedby="q-at-hint"
                    onChange={(e) => setEditing({ ...editing, draft: { ...editing.draft, at: e.target.value } })} />
                  {showPlayer ? (
                    <Button type="button" variant="outline" size="sm"
                      onClick={() => setEditing({ ...editing, draft: { ...editing.draft, at: clock(Math.floor(player.current?.currentTime() ?? now)) } })}>
                      <Crosshair aria-hidden className="size-4" />
                      {t('useCurrentTime', { time: nowClock })}
                    </Button>
                  ) : null}
                </div>
                <p id="q-at-hint" className="text-xs text-muted-foreground">{t('atTimeHint')}</p>
              </div>
            ) : null}
            <div className="flex flex-col gap-2">
              <Label htmlFor="q-topic">{t('bank.topic')}</Label>
              <Select id="q-topic" value={editing.draft.topicId} aria-describedby="q-topic-hint"
                onChange={(e) => setEditing({ ...editing, draft: { ...editing.draft, topicId: e.target.value } })}>
                <option value="">{t('bank.noTopic')}</option>
                {(topics ?? []).map((topic) => <option key={topic.id} value={topic.id}>{topic.name}</option>)}
              </Select>
              <p id="q-topic-hint" className="text-xs text-muted-foreground">{t('topicHint')}</p>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="q-text" required>{t('questionText')}</Label>
              <Textarea id="q-text" aria-required="true" rows={3} maxLength={1000} autoFocus={!showPlayer} value={editing.draft.text}
                onChange={(e) => setEditing({ ...editing, draft: { ...editing.draft, text: e.target.value } })} />
            </div>
            <div className="flex items-center justify-between gap-4">
              <Label htmlFor="q-multi">{t('allowMultiple')}</Label>
              <Switch id="q-multi" checked={editing.draft.allowMultiple}
                onCheckedChange={(checked) => setEditing({ ...editing, draft: { ...editing.draft, allowMultiple: checked } })} />
            </div>
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-2 text-sm font-medium">{t('options')}<span aria-hidden="true" className="ms-1 text-destructive">*</span></legend>
              {editing.draft.options.map((option, index) => (
                <div key={index} className="flex items-center gap-2">
                  <label className="flex shrink-0 items-center gap-1.5 text-sm">
                    <input
                      type={editing.draft.allowMultiple ? 'checkbox' : 'radio'}
                      name="correct"
                      checked={option.isCorrect}
                      onChange={(e) => setOption(index, { isCorrect: editing.draft.allowMultiple ? e.target.checked : true })}
                      className="size-4 accent-[var(--primary)]"
                    />
                    <span className="sr-only sm:not-sr-only">{t('isCorrect')}</span>
                  </label>
                  <Input
                    value={option.text}
                    maxLength={500}
                    placeholder={t('optionPlaceholder', { n: index + 1 })}
                    aria-label={t('optionPlaceholder', { n: index + 1 })}
                    onChange={(e) => setOption(index, { text: e.target.value })}
                  />
                  <button
                    type="button"
                    disabled={editing.draft.options.length <= 2}
                    aria-label={`${tCommon('remove')} ${index + 1}`}
                    onClick={() => setEditing({ ...editing, draft: { ...editing.draft, options: editing.draft.options.filter((_, i) => i !== index) } })}
                    className="rounded p-2 text-muted-foreground hover:text-destructive disabled:opacity-30"
                  >
                    <X aria-hidden className="size-4" />
                  </button>
                </div>
              ))}
              {editing.draft.options.length < 8 ? (
                <Button type="button" variant="ghost" size="sm" className="w-fit"
                  onClick={() => setEditing({ ...editing, draft: { ...editing.draft, options: [...editing.draft.options, { text: '', isCorrect: false }] } })}>
                  <Plus aria-hidden className="size-4" />
                  {t('addOption')}
                </Button>
              ) : null}
            </fieldset>
            <div className="flex flex-col gap-2">
              <Label htmlFor="q-explanation">{t('explanation')}</Label>
              <Textarea id="q-explanation" rows={2} maxLength={2000} value={editing.draft.explanation}
                onChange={(e) => setEditing({ ...editing, draft: { ...editing.draft, explanation: e.target.value } })} />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => { setEditing(null); setError(null); }}>{tCommon('cancel')}</Button>
              <Button type="submit" disabled={pending}>{pending ? tCommon('saving') : tCommon('save')}</Button>
            </div>
          </form>
        ) : (
          <div className="flex flex-col gap-3">
            {questions === null ? (
              <p role="status">{tCommon('loading')}</p>
            ) : questions.length === 0 ? (
              <p className="text-muted-foreground">{t('noQuestions')}</p>
            ) : (
              <ol className="flex flex-col gap-3">
                {[...questions].sort((a, b) => (a.atSec ?? a.position) - (b.atSec ?? b.position)).map((question) => (
                  <li key={question.id} className="rounded-xl border border-border p-4">
                    <div className="flex items-start gap-2">
                      <p className="flex-1 font-medium">
                        {question.atSec !== null ? (
                          <button
                            type="button"
                            title={t('jumpTo', { time: clock(question.atSec) })}
                            onClick={() => player.current?.seek(question.atSec!)}
                            className="me-2 rounded bg-primary-light px-1.5 py-0.5 font-mono text-xs text-primary hover:bg-primary hover:text-primary-foreground"
                          >
                            {clock(question.atSec)}
                          </button>
                        ) : (
                          `${question.position}. `
                        )}
                        {question.text}
                        {question.topicId ? (
                          <span className="ms-2 rounded-full bg-primary-light px-2 py-0.5 text-xs font-normal text-primary">
                            {topics?.find((topic) => topic.id === question.topicId)?.name}
                          </span>
                        ) : null}
                      </p>
                      {!locked ? (
                        <>
                          <button type="button" aria-label={t('editQuestion')} className="rounded p-1.5 text-muted-foreground hover:text-primary"
                            onClick={() => edit(question)}>
                            <Pencil aria-hidden className="size-4" />
                          </button>
                          <button type="button" aria-label={t('deleteQuestion')} className="rounded p-1.5 text-muted-foreground hover:text-destructive"
                            onClick={() => setDeletingId(question.id)}>
                            <Trash2 aria-hidden className="size-4" />
                          </button>
                        </>
                      ) : null}
                    </div>
                    <ul className="mt-2 flex flex-col gap-1 text-sm">
                      {question.options.map((option) => (
                        <li key={option.id} className={`flex items-center gap-2 ${option.isCorrect ? 'font-medium text-success' : 'text-muted-foreground'}`}>
                          {option.isCorrect ? <CheckCircle2 aria-label={t('isCorrect')} className="size-4" /> : <span className="size-4" />}
                          {option.text}
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ol>
            )}
            {!locked && !showPlayer ? (
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" className="w-fit" onClick={() => setPicking({ atSec: null })}>
                  <Library aria-hidden className="size-4" />
                  {t('fromBank.button')}
                </Button>
                <Button variant="outline" className="w-fit" onClick={() => setEditing({ id: null, draft: EMPTY })}>
                  <Plus aria-hidden className="size-4" />
                  {t('addQuestion')}
                </Button>
              </div>
            ) : null}
          </div>
        )}
      </DialogContent>
    </Dialog>
    <ConfirmDialog
      open={deletingId !== null}
      onOpenChange={(open) => !open && setDeletingId(null)}
      title={t('deleteQuestion')}
      body={tCommon('deleteConfirmBody')}
      confirmLabel={tCommon('delete')}
      successMessage={tCommon('toast.questionDeleted')}
      onConfirm={async () => {
        if (deletingId) setQuestions(parse(await api('DELETE', `instructor/questions/${deletingId}`)));
      }}
    />
    </>
  );
}
