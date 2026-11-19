'use client';

import {
  BankQuestionSaveSchema,
  BankQuestionSchema,
  QuestionTopicSchema,
  TopicInputSchema,
  type QuestionTopic,
  parseCsv,
  parseQuestionBank,
  QUESTION_CSV_TEMPLATE,
  sheetToQuestions,
  type BankQuestion,
  type ParsedBank,
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
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Textarea,
  toast,
} from '@obgyn/ui';
import { AlertTriangle, ArrowDown, ArrowUp, CheckCircle2, Download, FileSpreadsheet, FolderPlus, Pencil, Plus, Search, Trash2, Upload, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { z } from 'zod';
import { ApiClientError, api } from '@/lib/instructor-api';
import { ConfirmDialog } from '../confirm-dialog';
import { useTopics } from './topics';

const parseList = (data: unknown) => z.array(BankQuestionSchema).parse(data);

export const SAMPLE_MARKED = `# Module 1
Q: Nuchal translucency is measured when CRL is:
* 45–84 mm
- 20–40 mm
- 85–100 mm
Explanation: ISUOG first-trimester guideline.`;

export const SAMPLE_LETTERED = `# Entrance
1. The most accurate dating parameter in the first trimester is:
a) BPD
b) CRL
c) Femur length
Answer: b`;

/** Loads the bank and keeps it fresh across tabs. */
export function useBank(courseId: string) {
  const [bank, setBank] = useState<BankQuestion[] | null>(null);
  const [error, setError] = useState(false);
  const reload = () =>
    api('GET', `instructor/courses/${courseId}/bank`)
      .then((data) => setBank(parseList(data)))
      .catch(() => setError(true));
  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId]);
  return { bank, setBank: (data: unknown) => setBank(parseList(data)), error, reload };
}

export function topicsOf(bank: BankQuestion[]): string[] {
  return [...new Set(bank.map((q) => q.topic).filter((t): t is string => !!t))].sort((a, b) =>
    a.localeCompare(b, undefined, { numeric: true }),
  );
}

/** "" = all questions, NO_TOPIC = questions without a topic, otherwise a topic id. */
const NO_TOPIC = '__none';

/**
 * Question bank: topics on the left (create, rename, reorder, delete), the
 * selected topic's questions on the right with search, single add/edit,
 * import, and bulk move / delete.
 */
export function BankTab({ courseId, locked }: { courseId: string; locked: boolean }) {
  const t = useTranslations('Instructor.editor.bank');
  const tCommon = useTranslations('Common');
  const { bank, setBank, error } = useBank(courseId);
  const { topics, setTopics, reload: reloadTopics, error: topicsError } = useTopics(courseId);
  const [filter, setFilter] = useState('');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [importing, setImporting] = useState(false);
  const [editing, setEditing] = useState<BankQuestion | 'new' | null>(null);
  const [deleting, setDeleting] = useState<BankQuestion | null>(null);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [topicDialog, setTopicDialog] = useState<QuestionTopic | 'new' | null>(null);
  const [topicDeleting, setTopicDeleting] = useState<QuestionTopic | null>(null);
  const [moveTo, setMoveTo] = useState('');
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Bank changes alter topic counts.
  const onBank = (data: unknown) => {
    setBank(data);
    void reloadTopics();
  };

  const visible = useMemo(
    () =>
      (bank ?? []).filter(
        (q) =>
          (filter === '' || (filter === NO_TOPIC ? !q.topicId : q.topicId === filter)) &&
          (!query || q.text.toLowerCase().includes(query.toLowerCase())),
      ),
    [bank, filter, query],
  );
  // Drop selections that are no longer visible (filter changed, deleted…).
  useEffect(() => {
    setSelected((current) => new Set([...current].filter((id) => visible.some((q) => q.id === id))));
  }, [visible]);

  if (error || topicsError) return <p role="alert" className="text-destructive">{tCommon('genericError')}</p>;
  if (!bank || !topics) return <p role="status">{tCommon('loading')}</p>;

  const untagged = bank.filter((q) => !q.topicId).length;
  const current = topics.find((topic) => topic.id === filter) ?? null;
  const allSelected = visible.length > 0 && visible.every((q) => selected.has(q.id));

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setActionError(null);
    try {
      await fn();
    } catch (e) {
      setActionError((e as { messageText?: string }).messageText ?? tCommon('genericError'));
    } finally {
      setBusy(false);
    }
  };

  const moveTopic = (index: number, delta: number) =>
    run(async () => {
      const ids = topics.map((topic) => topic.id);
      const [moved] = ids.splice(index, 1);
      ids.splice(index + delta, 0, moved!);
      setTopics(await api('PUT', `instructor/courses/${courseId}/topics/order`, { ids }));
    });

  const filterButton = (value: string, label: string, count: number) => (
    <button
      type="button"
      aria-pressed={filter === value}
      onClick={() => setFilter(value)}
      className={`flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-start text-sm ${
        filter === value ? 'bg-primary text-primary-foreground' : 'hover:bg-primary-light hover:text-primary'
      }`}
    >
      <span className="min-w-0 truncate">{label}</span>
      <span className="shrink-0 tabular-nums opacity-80">{count}</span>
    </button>
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3 surface p-4">
        <p className="max-w-2xl text-sm text-muted-foreground">{t('intro')}</p>
        {!locked ? (
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setImporting(true)}>
              <Upload aria-hidden className="size-4" />
              {t('import')}
            </Button>
            <Button onClick={() => setEditing('new')}>
              <Plus aria-hidden className="size-4" />
              {t('addQuestion')}
            </Button>
          </div>
        ) : null}
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-[280px_1fr]">
        {/* Topics */}
        <nav aria-label={t('topicsTitle')} className="flex flex-col gap-2 surface p-3 lg:sticky lg:top-20">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-sm font-semibold">{t('topicsTitle')}</h2>
            {!locked ? (
              <Button variant="ghost" size="sm" onClick={() => setTopicDialog('new')}>
                <FolderPlus aria-hidden className="size-4" />
                {t('newTopic')}
              </Button>
            ) : null}
          </div>
          {filterButton('', t('allQuestions'), bank.length)}
          <ul className="flex max-h-[28rem] flex-col gap-0.5 overflow-y-auto">
            {topics.map((topic, index) => (
              <li key={topic.id} className="group flex items-center gap-0.5">
                <div className="min-w-0 flex-1">{filterButton(topic.id, topic.name, topic.bankCount)}</div>
                {!locked ? (
                  <span className="flex shrink-0 opacity-60 group-focus-within:opacity-100 group-hover:opacity-100">
                    <button type="button" disabled={busy || index === 0} aria-label={t('moveUp', { name: topic.name })}
                      className="rounded p-1 hover:text-primary disabled:opacity-30" onClick={() => void moveTopic(index, -1)}>
                      <ArrowUp aria-hidden className="size-3.5" />
                    </button>
                    <button type="button" disabled={busy || index === topics.length - 1} aria-label={t('moveDown', { name: topic.name })}
                      className="rounded p-1 hover:text-primary disabled:opacity-30" onClick={() => void moveTopic(index, 1)}>
                      <ArrowDown aria-hidden className="size-3.5" />
                    </button>
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
          {untagged > 0 ? filterButton(NO_TOPIC, t('noTopic'), untagged) : null}
          {topics.length === 0 ? <p className="px-1 text-xs text-muted-foreground">{t('noTopicsYet')}</p> : null}
        </nav>

        {/* Questions */}
        <section aria-labelledby="bank-heading" className="flex min-w-0 flex-col gap-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 id="bank-heading" className="text-lg font-semibold">
                {current ? current.name : filter === NO_TOPIC ? t('noTopic') : t('allQuestions')}
              </h2>
              {current?.description ? <p className="text-sm text-muted-foreground">{current.description}</p> : null}
              {current ? (
                <p className="text-xs text-muted-foreground">{t('topicUsage', { bank: current.bankCount, lessons: current.lessonCount })}</p>
              ) : null}
            </div>
            {current && !locked ? (
              <div className="flex gap-1">
                <Button variant="ghost" size="sm" onClick={() => setTopicDialog(current)}>
                  <Pencil aria-hidden className="size-4" />
                  {t('renameTopic')}
                </Button>
                <Button variant="ghost" size="sm" className="text-destructive" onClick={() => setTopicDeleting(current)}>
                  <Trash2 aria-hidden className="size-4" />
                  {t('deleteTopic')}
                </Button>
              </div>
            ) : null}
          </div>

          <label className="flex items-center gap-2 rounded-md border border-border bg-card px-3">
            <Search aria-hidden className="size-4 text-muted-foreground" />
            <span className="sr-only">{t('search')}</span>
            <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('search')} className="h-10 flex-1 bg-transparent outline-none" />
          </label>

          {!locked && visible.length > 0 ? (
            <div className="flex flex-wrap items-center gap-3 surface-sm px-3 py-2 text-sm" aria-live="polite">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={(e) => setSelected(e.target.checked ? new Set(visible.map((q) => q.id)) : new Set())}
                  className="size-4 accent-[var(--primary)]"
                />
                {selected.size ? t('selected', { count: selected.size }) : t('selectAll')}
              </label>
              {selected.size ? (
                <>
                  <span className="ms-auto flex items-center gap-2">
                    <Select value={moveTo} onChange={(e) => setMoveTo(e.target.value)} aria-label={t('moveTo')} className="h-9 w-48">
                      <option value="">{t('moveTo')}</option>
                      {topics.map((topic) => <option key={topic.id} value={topic.id}>{topic.name}</option>)}
                      <option value={NO_TOPIC}>{t('noTopic')}</option>
                    </Select>
                    <Button size="sm" disabled={!moveTo || busy}
                      onClick={() => void run(async () => {
                        onBank(await api('POST', `instructor/courses/${courseId}/bank/bulk`, {
                          action: 'move', ids: [...selected], topicId: moveTo === NO_TOPIC ? null : moveTo,
                        }));
                        setSelected(new Set());
                        setMoveTo('');
                        toast.success(tCommon('toast.moved'));
                      })}>
                      {t('move')}
                    </Button>
                  </span>
                  <Button size="sm" variant="outline" className="text-destructive" disabled={busy} onClick={() => setBulkDeleting(true)}>
                    <Trash2 aria-hidden className="size-4" />
                    {tCommon('delete')}
                  </Button>
                </>
              ) : null}
            </div>
          ) : null}
          {actionError ? <p role="alert" className="text-sm text-destructive">{actionError}</p> : null}

          {bank.length === 0 ? (
            <p className="soft-wash rounded-3xl p-10 text-center text-muted-foreground">{t('empty')}</p>
          ) : visible.length === 0 ? (
            <p className="soft-wash rounded-3xl p-10 text-center text-muted-foreground">{t('noneHere')}</p>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">{t('total', { count: visible.length })}</p>
              <ul className="flex flex-col gap-3">
                {visible.map((q) => (
                  <li key={q.id} className={`rounded-xl border bg-card p-4 ${selected.has(q.id) ? 'border-primary' : 'border-border'}`}>
                    <div className="flex items-start gap-3">
                      {!locked ? (
                        <input
                          type="checkbox"
                          aria-label={t('selectQuestion')}
                          checked={selected.has(q.id)}
                          onChange={(e) => {
                            const next = new Set(selected);
                            if (e.target.checked) next.add(q.id);
                            else next.delete(q.id);
                            setSelected(next);
                          }}
                          className="mt-1 size-4 shrink-0 accent-[var(--primary)]"
                        />
                      ) : null}
                      <div className="min-w-0 flex-1">
                        <p className="font-medium">{q.text}</p>
                        <p className="mt-1 flex flex-wrap gap-2 text-xs text-muted-foreground">
                          {q.topic ? (
                            <span className="rounded-full bg-primary-light px-2 py-0.5 text-primary">{q.topic}</span>
                          ) : (
                            <span className="rounded-full bg-muted px-2 py-0.5">{t('noTopic')}</span>
                          )}
                          {q.usedCount > 0 ? <span>{t('used', { count: q.usedCount })}</span> : null}
                        </p>
                        <ul className="mt-2 grid gap-1 text-sm sm:grid-cols-2">
                          {q.options.map((o, i) => (
                            <li key={i} className={`flex items-center gap-2 ${o.isCorrect ? 'font-medium text-success' : 'text-muted-foreground'}`}>
                              {o.isCorrect ? <CheckCircle2 aria-hidden className="size-4 shrink-0" /> : <span className="size-4 shrink-0" />}
                              {o.text}
                            </li>
                          ))}
                        </ul>
                      </div>
                      {!locked ? (
                        <span className="flex shrink-0">
                          <button type="button" aria-label={t('editTitle')} className="rounded p-1.5 text-muted-foreground hover:text-primary" onClick={() => setEditing(q)}>
                            <Pencil aria-hidden className="size-4" />
                          </button>
                          <button type="button" aria-label={tCommon('delete')} className="rounded p-1.5 text-muted-foreground hover:text-destructive" onClick={() => setDeleting(q)}>
                            <Trash2 aria-hidden className="size-4" />
                          </button>
                        </span>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      </div>

      {importing ? (
        <ImportDialog courseId={courseId} topics={topics} defaultTopic={current?.name ?? ''} onClose={() => setImporting(false)} onImported={onBank} />
      ) : null}
      {editing ? (
        <BankQuestionDialog
          courseId={courseId}
          question={editing === 'new' ? null : editing}
          topics={topics}
          defaultTopicId={current?.id ?? null}
          onClose={() => setEditing(null)}
          onSaved={onBank}
        />
      ) : null}
      {topicDialog ? (
        <TopicDialog courseId={courseId} topic={topicDialog === 'new' ? null : topicDialog} onClose={() => setTopicDialog(null)}
          onSaved={(data, name) => {
            setTopics(data);
            // Open a newly created topic straight away.
            const created = topicDialog === 'new' ? z.array(QuestionTopicSchema).parse(data).find((x) => x.name === name) : null;
            if (created) setFilter(created.id);
            // Renaming changes the names shown on questions.
            if (topicDialog !== 'new') void api('GET', `instructor/courses/${courseId}/bank`).then(setBank);
          }} />
      ) : null}
      {topicDeleting ? (
        <ConfirmDialog
          open
          onOpenChange={(open) => !open && setTopicDeleting(null)}
          title={t('deleteTopicTitle', { name: topicDeleting.name })}
          body={t('deleteTopicBody', { count: topicDeleting.bankCount })}
          confirmLabel={t('deleteTopic')}
          successMessage={tCommon('toast.deleted')}
          onConfirm={async () => {
            setTopics(await api('DELETE', `instructor/topics/${topicDeleting.id}`));
            setFilter('');
            setBank(await api('GET', `instructor/courses/${courseId}/bank`));
          }}
        />
      ) : null}
      {deleting ? (
        <ConfirmDialog
          open
          onOpenChange={(open) => !open && setDeleting(null)}
          title={tCommon('delete')}
          body={t('deleteConfirm')}
          confirmLabel={tCommon('delete')}
          successMessage={tCommon('toast.questionDeleted')}
          onConfirm={async () => onBank(await api('DELETE', `instructor/bank/${deleting.id}`))}
        />
      ) : null}
      {bulkDeleting ? (
        <ConfirmDialog
          open
          onOpenChange={(open) => !open && setBulkDeleting(false)}
          title={tCommon('delete')}
          body={t('bulkDeleteConfirm', { count: selected.size })}
          confirmLabel={tCommon('delete')}
          successMessage={tCommon('toast.deleted')}
          onConfirm={async () => {
            onBank(await api('POST', `instructor/courses/${courseId}/bank/bulk`, { action: 'delete', ids: [...selected] }));
            setSelected(new Set());
          }}
        />
      ) : null}
    </div>
  );
}

function TopicDialog({
  courseId,
  topic,
  onClose,
  onSaved,
}: {
  courseId: string;
  topic: QuestionTopic | null;
  onClose: () => void;
  onSaved: (data: unknown, name: string) => void;
}) {
  const t = useTranslations('Instructor.editor.bank');
  const tCommon = useTranslations('Common');
  const [name, setName] = useState(topic?.name ?? '');
  const [description, setDescription] = useState(topic?.description ?? '');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async (e: FormEvent) => {
    e.preventDefault();
    const input = TopicInputSchema.safeParse({ name, description: description.trim() || null });
    if (!input.success) return setError(input.error.issues[0]?.message ?? tCommon('genericError'));
    setPending(true);
    setError(null);
    try {
      const data = topic
        ? await api('PATCH', `instructor/topics/${topic.id}`, input.data)
        : await api('POST', `instructor/courses/${courseId}/topics`, input.data);
      onSaved(data, input.data.name);
      toast.success(tCommon('toast.saved'));
      onClose();
    } catch (err) {
      setError(err instanceof ApiClientError && err.status === 409 ? t('topicExists') : tCommon('genericError'));
    } finally {
      setPending(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg" closeLabel={tCommon('close')} aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>{topic ? t('renameTopic') : t('newTopic')}</DialogTitle>
        </DialogHeader>
        <form onSubmit={save} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="topic-name">{t('topicName')}</Label>
            <Input id="topic-name" autoFocus required maxLength={80} value={name} placeholder={t('topicNamePlaceholder')} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="topic-description">{t('topicDescription')}</Label>
            <Textarea id="topic-description" rows={2} maxLength={300} value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>{tCommon('cancel')}</Button>
            <Button type="submit" disabled={pending}>{pending ? tCommon('saving') : tCommon('save')}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Reads a CSV or Excel (.xlsx) file into bank questions. */
async function readQuestionFile(file: File): Promise<ParsedBank> {
  const name = file.name.toLowerCase();
  if (name.endsWith('.xlsx')) {
    const { readSheet } = await import('read-excel-file/browser');
    return sheetToQuestions(await readSheet(file));
  }
  if (name.endsWith('.csv') || name.endsWith('.tsv') || name.endsWith('.txt') || file.type.includes('csv')) {
    return sheetToQuestions(parseCsv(await file.text()));
  }
  return { questions: [], errors: [{ line: 1, message: 'Use a .csv or .xlsx file (old .xls files: save as .xlsx first).' }] };
}

function downloadTemplate() {
  const blob = new Blob(['\uFEFF' + QUESTION_CSV_TEMPLATE], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = Object.assign(document.createElement('a'), { href: url, download: 'question-bank-template.csv' });
  link.click();
  URL.revokeObjectURL(url);
}

function ImportDialog({
  courseId,
  topics,
  defaultTopic,
  onClose,
  onImported,
}: {
  courseId: string;
  topics: QuestionTopic[];
  /** Topic name for imported questions that don't name one ("" = none). */
  defaultTopic: string;
  onClose: () => void;
  onImported: (data: unknown) => void;
}) {
  const t = useTranslations('Instructor.editor.bank');
  const tCommon = useTranslations('Common');
  const [mode, setMode] = useState<'file' | 'paste'>('file');
  const [text, setText] = useState('');
  const [fileResult, setFileResult] = useState<{ name: string; parsed: ParsedBank } | null>(null);
  const [reading, setReading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fallbackTopic, setFallbackTopic] = useState(defaultTopic);
  const pasted = useMemo(() => parseQuestionBank(text), [text]);
  const parsed: ParsedBank = mode === 'paste' ? pasted : (fileResult?.parsed ?? { questions: [], errors: [] });

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setReading(true);
    setError(null);
    try {
      setFileResult({ name: file.name, parsed: await readQuestionFile(file) });
    } catch {
      setFileResult({ name: file.name, parsed: { questions: [], errors: [{ line: 1, message: t('fileUnreadable') }] } });
    } finally {
      setReading(false);
    }
  };

  const submit = async () => {
    setPending(true);
    setError(null);
    try {
      onImported(await api('POST', `instructor/courses/${courseId}/bank/import`, {
        questions: parsed.questions.map((q) => ({ ...q, topic: q.topic || fallbackTopic || null })),
      }));
      toast.success(tCommon('toast.imported', { count: parsed.questions.length }));
      onClose();
    } catch (e) {
      setError((e as { messageText?: string }).messageText ?? tCommon('genericError'));
    } finally {
      setPending(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-5xl" closeLabel={tCommon('close')} aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>{t('importTitle')}</DialogTitle>
        </DialogHeader>
        <Tabs value={mode} onValueChange={(value) => setMode(value as 'file' | 'paste')}>
          <TabsList>
            <TabsTrigger value="file">{t('tabFile')}</TabsTrigger>
            <TabsTrigger value="paste">{t('tabPaste')}</TabsTrigger>
          </TabsList>

          <TabsContent value="file" className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="max-w-2xl text-sm text-muted-foreground">{t('fileHelp')}</p>
              <Button type="button" variant="outline" size="sm" onClick={downloadTemplate}>
                <Download aria-hidden className="size-4" />
                {t('downloadTemplate')}
              </Button>
            </div>
            <label
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                void onFile(e.dataTransfer.files[0]);
              }}
              className={`flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed p-8 text-center ${
                dragging ? 'border-primary bg-primary-light' : 'border-border hover:border-primary'
              }`}
            >
              <FileSpreadsheet aria-hidden className="size-10 text-primary" />
              <span className="font-medium">{fileResult ? fileResult.name : t('chooseFile')}</span>
              <span className="text-xs text-muted-foreground">{reading ? tCommon('loading') : t('fileTypes')}</span>
              <input
                type="file"
                accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                className="sr-only"
                onChange={(e) => {
                  void onFile(e.target.files?.[0]);
                  e.target.value = '';
                }}
              />
            </label>
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-left text-xs">
                <caption className="sr-only">{t('columnsCaption')}</caption>
                <thead className="bg-muted">
                  <tr>
                    {['Topic', 'Question', 'Option A', 'Option B', 'Option C', 'Option D', 'Correct', 'Explanation'].map((h) => (
                      <th key={h} scope="col" className="px-2 py-1.5 font-semibold">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr className="text-muted-foreground">
                    <td className="px-2 py-1.5">Module 1</td>
                    <td className="px-2 py-1.5">NT is measured when CRL is:</td>
                    <td className="px-2 py-1.5">45–84 mm</td>
                    <td className="px-2 py-1.5">20–40 mm</td>
                    <td className="px-2 py-1.5">85–100 mm</td>
                    <td className="px-2 py-1.5" />
                    <td className="px-2 py-1.5">A</td>
                    <td className="px-2 py-1.5">ISUOG guideline</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="text-xs text-muted-foreground">{t('correctHelp')}</p>
          </TabsContent>

          <TabsContent value="paste" className="flex flex-col gap-4">
            <p className="text-sm text-muted-foreground">{t('importHelp')}</p>
            <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
              <div className="flex flex-col gap-2">
                <Label htmlFor="bank-paste">{t('pasteLabel')}</Label>
                <Textarea id="bank-paste" rows={16} className="font-mono text-sm" value={text} onChange={(e) => setText(e.target.value)} placeholder={SAMPLE_MARKED} />
              </div>
              <div className="flex flex-col gap-3 text-xs">
                <div>
                  <p className="mb-1 font-semibold">{t('formatMarked')}</p>
                  <pre className="whitespace-pre-wrap rounded-lg bg-muted p-2">{SAMPLE_MARKED}</pre>
                </div>
                <div>
                  <p className="mb-1 font-semibold">{t('formatLettered')}</p>
                  <pre className="whitespace-pre-wrap rounded-lg bg-muted p-2">{SAMPLE_LETTERED}</pre>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <div className="flex flex-wrap items-center gap-3 rounded-lg bg-muted p-3 text-sm">
          <Label htmlFor="import-topic">{t('importTopic')}</Label>
          <Select id="import-topic" className="w-64" value={fallbackTopic} onChange={(e) => setFallbackTopic(e.target.value)}>
            <option value="">{t('noTopic')}</option>
            {topics.map((topic) => <option key={topic.id} value={topic.name}>{topic.name}</option>)}
          </Select>
          <span className="text-xs text-muted-foreground">{t('importTopicHelp')}</span>
        </div>
        <div aria-live="polite" className="flex flex-col gap-1 text-sm">
          <p className="flex items-center gap-2 font-medium text-success">
            <CheckCircle2 aria-hidden className="size-4" />
            {t('preview', { count: parsed.questions.length })}
          </p>
          {parsed.errors.length > 0 ? (
            <div className="rounded-lg border border-amber-300 bg-amber-50 p-2 text-amber-900 dark:bg-amber-900/30 dark:text-amber-100">
              <p className="flex items-center gap-2 font-medium">
                <AlertTriangle aria-hidden className="size-4" />
                {t('problems', { count: parsed.errors.length })}
              </p>
              <ul className="mt-1 list-disc ps-5">
                {parsed.errors.slice(0, 8).map((e) => (
                  <li key={e.line}>
                    {mode === 'file' ? t('rowLabel', { row: e.line }) : e.line}: {e.message}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {error ? <p role="alert" className="text-destructive">{error}</p> : null}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{tCommon('cancel')}</Button>
          <Button disabled={pending || parsed.questions.length === 0} onClick={submit}>
            {pending ? tCommon('saving') : t('importButton', { count: parsed.questions.length })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function BankQuestionDialog({
  courseId,
  question,
  topics,
  defaultTopicId,
  onClose,
  onSaved,
}: {
  courseId: string;
  /** null = new question. */
  question: BankQuestion | null;
  topics: QuestionTopic[];
  defaultTopicId: string | null;
  onClose: () => void;
  onSaved: (data: unknown) => void;
}) {
  const t = useTranslations('Instructor.editor');
  const tCommon = useTranslations('Common');
  const [draft, setDraft] = useState({
    topicId: question ? (question.topicId ?? '') : (defaultTopicId ?? ''),
    text: question?.text ?? '',
    explanation: question?.explanation ?? '',
    options: question?.options ?? [
      { text: '', isCorrect: true },
      { text: '', isCorrect: false },
      { text: '', isCorrect: false },
      { text: '', isCorrect: false },
    ],
  });
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    const body = BankQuestionSaveSchema.safeParse({
      topicId: draft.topicId || null,
      text: draft.text,
      explanation: draft.explanation.trim() || null,
      options: draft.options.filter((o) => o.text.trim()),
    });
    if (!body.success) return setError(body.error.issues[0]?.message ?? tCommon('genericError'));
    setPending(true);
    setError(null);
    try {
      onSaved(question ? await api('PATCH', `instructor/bank/${question.id}`, body.data) : await api('POST', `instructor/courses/${courseId}/bank`, body.data));
      toast.success(tCommon(question ? 'toast.saved' : 'toast.questionAdded'));
      onClose();
    } catch (e) {
      setError((e as { messageText?: string }).messageText ?? tCommon('genericError'));
    } finally {
      setPending(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl" closeLabel={tCommon('close')} aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>{question ? t('bank.editTitle') : t('bank.addQuestion')}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-2">
          <Label htmlFor="bank-topic">{t('bank.topic')}</Label>
          <Select id="bank-topic" value={draft.topicId} onChange={(e) => setDraft({ ...draft, topicId: e.target.value })}>
            <option value="">{t('bank.noTopic')}</option>
            {topics.map((topic) => <option key={topic.id} value={topic.id}>{topic.name}</option>)}
          </Select>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="bank-text">{t('questionText')}</Label>
          <Textarea id="bank-text" rows={3} autoFocus value={draft.text} onChange={(e) => setDraft({ ...draft, text: e.target.value })} />
        </div>
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-sm font-medium">{t('options')}</legend>
          <p className="text-xs text-muted-foreground">{t('bank.tickCorrect')}</p>
          {draft.options.map((o, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                type="checkbox"
                aria-label={t('isCorrect')}
                checked={o.isCorrect}
                onChange={(e) => setDraft({ ...draft, options: draft.options.map((x, j) => (j === i ? { ...x, isCorrect: e.target.checked } : x)) })}
                className="size-4 accent-[var(--primary)]"
              />
              <Input value={o.text} aria-label={t('optionPlaceholder', { n: i + 1 })} placeholder={t('optionPlaceholder', { n: i + 1 })} onChange={(e) => setDraft({ ...draft, options: draft.options.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)) })} />
              <button type="button" disabled={draft.options.length <= 2} aria-label={tCommon('remove')} className="rounded p-2 text-muted-foreground hover:text-destructive disabled:opacity-30"
                onClick={() => setDraft({ ...draft, options: draft.options.filter((_, j) => j !== i) })}>
                <X aria-hidden className="size-4" />
              </button>
            </div>
          ))}
          {draft.options.length < 8 ? (
            <Button type="button" variant="ghost" size="sm" className="w-fit" onClick={() => setDraft({ ...draft, options: [...draft.options, { text: '', isCorrect: false }] })}>
              {t('addOption')}
            </Button>
          ) : null}
        </fieldset>
        <div className="flex flex-col gap-2">
          <Label htmlFor="bank-explanation">{t('explanation')}</Label>
          <Textarea id="bank-explanation" rows={2} value={draft.explanation} onChange={(e) => setDraft({ ...draft, explanation: e.target.value })} />
        </div>
        {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{tCommon('cancel')}</Button>
          <Button disabled={pending} onClick={save}>{pending ? tCommon('saving') : tCommon('save')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
