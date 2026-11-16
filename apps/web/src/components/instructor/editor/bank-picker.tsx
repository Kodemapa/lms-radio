'use client';

import { type BankQuestion } from '@obgyn/types';
import { Button, Select } from '@obgyn/ui';
import { CheckCircle2, Search } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';
import { useBank } from './bank-tab';
import { useTopics } from './topics';

/**
 * Pick questions from the course bank. Quizzes take several at once; a video
 * takes one at a time, placed at `atLabel` (the current video time).
 */
export function BankPicker({
  courseId,
  single,
  atLabel,
  usedIds,
  onAdd,
  onCancel,
}: {
  courseId: string;
  single: boolean;
  atLabel?: string;
  usedIds: Set<string>;
  onAdd: (ids: string[]) => Promise<void>;
  onCancel: () => void;
}) {
  const t = useTranslations('Instructor.editor');
  const tCommon = useTranslations('Common');
  const { bank } = useBank(courseId);
  const { topics } = useTopics(courseId);
  const [topic, setTopic] = useState('');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [pending, setPending] = useState(false);

  const visible = useMemo(
    () =>
      (bank ?? []).filter(
        (q: BankQuestion) =>
          (!topic || q.topicId === topic) && (!query || q.text.toLowerCase().includes(query.toLowerCase())),
      ),
    [bank, topic, query],
  );

  if (!bank) return <p role="status">{tCommon('loading')}</p>;
  if (bank.length === 0) return <p className="rounded-lg bg-muted p-3 text-sm">{t('fromBank.emptyBank')}</p>;

  const toggle = (id: string) =>
    setSelected((current) => (single ? [id] : current.includes(id) ? current.filter((x) => x !== id) : [...current, id]));

  return (
    <div className="flex flex-col gap-3">
      <p className="font-semibold">{t('fromBank.title')}</p>
      {single && atLabel ? <p className="text-sm text-muted-foreground">{t('fromBank.pickOne', { time: atLabel })}</p> : null}
      <div className="flex flex-wrap gap-2">
        <label className="flex flex-1 items-center gap-2 rounded-md border border-border px-3">
          <Search aria-hidden className="size-4 text-muted-foreground" />
          <span className="sr-only">{t('bank.search')}</span>
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('bank.search')} className="h-9 flex-1 bg-transparent outline-none" />
        </label>
        <div className="w-48">
          <Select value={topic} onChange={(e) => setTopic(e.target.value)} aria-label={t('bank.topic')}>
            <option value="">{t('bank.allTopics')}</option>
            {(topics ?? []).map((x) => <option key={x.id} value={x.id}>{x.name} ({x.bankCount})</option>)}
          </Select>
        </div>
      </div>
      <ul className="flex max-h-80 flex-col gap-1.5 overflow-y-auto rounded-lg border border-border p-2">
        {visible.map((q) => {
          const used = usedIds.has(q.id);
          return (
            <li key={q.id}>
              <label className={`flex cursor-pointer items-start gap-3 rounded-md p-2 text-sm hover:bg-muted ${selected.includes(q.id) ? 'bg-primary-light' : ''}`}>
                <input
                  type={single ? 'radio' : 'checkbox'}
                  name="bank-pick"
                  checked={selected.includes(q.id)}
                  onChange={() => toggle(q.id)}
                  className="mt-0.5 size-4 accent-[var(--primary)]"
                />
                <span className="flex-1">
                  {q.text}
                  <span className="mt-0.5 flex flex-wrap gap-2 text-xs text-muted-foreground">
                    {q.topic ? <span>{q.topic}</span> : null}
                    <span>{q.options.length} options</span>
                    {used ? (
                      <span className="flex items-center gap-1 text-success">
                        <CheckCircle2 aria-hidden className="size-3" />
                        {t('fromBank.alreadyUsed')}
                      </span>
                    ) : null}
                  </span>
                </span>
              </label>
            </li>
          );
        })}
      </ul>
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onCancel}>{tCommon('cancel')}</Button>
        <Button
          disabled={selected.length === 0 || pending}
          onClick={async () => {
            setPending(true);
            try {
              await onAdd(selected);
            } finally {
              setPending(false);
            }
          }}
        >
          {single && atLabel ? t('fromBank.addAt', { time: atLabel }) : t('fromBank.addSelected', { count: selected.length })}
        </Button>
      </div>
    </div>
  );
}
