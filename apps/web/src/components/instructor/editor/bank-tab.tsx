'use client';

import {
  BankQuestionSchema,
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
} from '@obgyn/ui';
import { AlertTriangle, CheckCircle2, Download, FileSpreadsheet, Pencil, Search, Trash2, Upload, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useMemo, useState } from 'react';
import { z } from 'zod';
import { api } from '@/lib/instructor-api';
import { ConfirmDialog } from '../confirm-dialog';

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

export function BankTab({ courseId, locked }: { courseId: string; locked: boolean }) {
  const t = useTranslations('Instructor.editor.bank');
  const tCommon = useTranslations('Common');
  const { bank, setBank, error } = useBank(courseId);
  const [topic, setTopic] = useState('');
  const [query, setQuery] = useState('');
  const [importing, setImporting] = useState(false);
  const [editing, setEditing] = useState<BankQuestion | null>(null);
  const [deleting, setDeleting] = useState<BankQuestion | null>(null);

  const visible = useMemo(
    () =>
      (bank ?? []).filter(
        (q) =>
          (topic === '' || (topic === '__none' ? !q.topic : q.topic === topic)) &&
          (!query || q.text.toLowerCase().includes(query.toLowerCase())),
      ),
    [bank, topic, query],
  );

  if (error) return <p role="alert" className="text-destructive">{tCommon('genericError')}</p>;
  if (!bank) return <p role="status">{tCommon('loading')}</p>;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4">
        <p className="max-w-2xl text-sm text-muted-foreground">{t('intro')}</p>
        {!locked ? (
          <Button onClick={() => setImporting(true)}>
            <Upload aria-hidden className="size-4" />
            {t('import')}
          </Button>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <label className="flex flex-1 items-center gap-2 rounded-md border border-border bg-card px-3">
          <Search aria-hidden className="size-4 text-muted-foreground" />
          <span className="sr-only">{t('search')}</span>
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('search')} className="h-10 flex-1 bg-transparent outline-none" />
        </label>
        <div className="w-56">
          <Select value={topic} onChange={(e) => setTopic(e.target.value)} aria-label={t('topic')}>
            <option value="">{t('allTopics')} ({bank.length})</option>
            {topicsOf(bank).map((name) => (
              <option key={name} value={name}>
                {name} ({bank.filter((q) => q.topic === name).length})
              </option>
            ))}
            {bank.some((q) => !q.topic) ? <option value="__none">{t('noTopic')}</option> : null}
          </Select>
        </div>
      </div>

      {bank.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border bg-card p-10 text-center text-muted-foreground">{t('empty')}</p>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">{t('total', { count: visible.length })}</p>
          <ul className="flex flex-col gap-3">
            {visible.map((q) => (
              <li key={q.id} className="rounded-xl border border-border bg-card p-4">
                <div className="flex items-start gap-2">
                  <div className="flex-1">
                    <p className="font-medium">{q.text}</p>
                    <p className="mt-1 flex flex-wrap gap-2 text-xs text-muted-foreground">
                      {q.topic ? <span className="rounded-full bg-primary-light px-2 py-0.5 text-primary">{q.topic}</span> : null}
                      {q.usedCount > 0 ? <span>{t('used', { count: q.usedCount })}</span> : null}
                    </p>
                  </div>
                  {!locked ? (
                    <>
                      <button type="button" aria-label={t('editTitle')} className="rounded p-1.5 text-muted-foreground hover:text-primary" onClick={() => setEditing(q)}>
                        <Pencil aria-hidden className="size-4" />
                      </button>
                      <button type="button" aria-label={tCommon('delete')} className="rounded p-1.5 text-muted-foreground hover:text-destructive" onClick={() => setDeleting(q)}>
                        <Trash2 aria-hidden className="size-4" />
                      </button>
                    </>
                  ) : null}
                </div>
                <ul className="mt-2 grid gap-1 text-sm sm:grid-cols-2">
                  {q.options.map((o, i) => (
                    <li key={i} className={`flex items-center gap-2 ${o.isCorrect ? 'font-medium text-success' : 'text-muted-foreground'}`}>
                      {o.isCorrect ? <CheckCircle2 aria-hidden className="size-4 shrink-0" /> : <span className="size-4 shrink-0" />}
                      {o.text}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </>
      )}

      {importing ? <ImportDialog courseId={courseId} onClose={() => setImporting(false)} onImported={setBank} /> : null}
      {editing ? <EditBankDialog question={editing} onClose={() => setEditing(null)} onSaved={setBank} /> : null}
      {deleting ? (
        <ConfirmDialog
          open
          onOpenChange={(open) => !open && setDeleting(null)}
          title={tCommon('delete')}
          body={t('deleteConfirm')}
          confirmLabel={tCommon('delete')}
          onConfirm={async () => setBank(await api('DELETE', `instructor/bank/${deleting.id}`))}
        />
      ) : null}
    </div>
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

function ImportDialog({ courseId, onClose, onImported }: { courseId: string; onClose: () => void; onImported: (data: unknown) => void }) {
  const t = useTranslations('Instructor.editor.bank');
  const tCommon = useTranslations('Common');
  const [mode, setMode] = useState<'file' | 'paste'>('file');
  const [text, setText] = useState('');
  const [fileResult, setFileResult] = useState<{ name: string; parsed: ParsedBank } | null>(null);
  const [reading, setReading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
      onImported(await api('POST', `instructor/courses/${courseId}/bank/import`, { questions: parsed.questions }));
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

function EditBankDialog({ question, onClose, onSaved }: { question: BankQuestion; onClose: () => void; onSaved: (data: unknown) => void }) {
  const t = useTranslations('Instructor.editor');
  const tCommon = useTranslations('Common');
  const [draft, setDraft] = useState({
    topic: question.topic ?? '',
    text: question.text,
    explanation: question.explanation ?? '',
    options: question.options,
  });
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setPending(true);
    setError(null);
    try {
      onSaved(
        await api('PATCH', `instructor/bank/${question.id}`, {
          topic: draft.topic.trim() || null,
          text: draft.text,
          explanation: draft.explanation.trim() || null,
          options: draft.options.filter((o) => o.text.trim()),
        }),
      );
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
          <DialogTitle>{t('bank.editTitle')}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-2">
          <Label htmlFor="bank-topic">{t('bank.topic')}</Label>
          <Input id="bank-topic" value={draft.topic} maxLength={80} onChange={(e) => setDraft({ ...draft, topic: e.target.value })} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="bank-text">{t('questionText')}</Label>
          <Textarea id="bank-text" rows={3} value={draft.text} onChange={(e) => setDraft({ ...draft, text: e.target.value })} />
        </div>
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-sm font-medium">{t('options')}</legend>
          {draft.options.map((o, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                type="checkbox"
                aria-label={t('isCorrect')}
                checked={o.isCorrect}
                onChange={(e) => setDraft({ ...draft, options: draft.options.map((x, j) => (j === i ? { ...x, isCorrect: e.target.checked } : x)) })}
                className="size-4 accent-[var(--primary)]"
              />
              <Input value={o.text} aria-label={t('optionPlaceholder', { n: i + 1 })} onChange={(e) => setDraft({ ...draft, options: draft.options.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)) })} />
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
