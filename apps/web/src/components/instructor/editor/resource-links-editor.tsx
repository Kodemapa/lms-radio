'use client';

import { type ResourceLink } from '@obgyn/types';
import { Button, Input } from '@obgyn/ui';
import { ExternalLink, Plus, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { newId } from '@/components/imaging/imaging-workspace';

/** Suggestions for obstetric calculators; instructors can add any https link. */
const SUGGESTIONS: { title: string; url: string }[] = [
  { title: 'FMF calculators', url: 'https://www.fetalmedicine.org/website/calculators' },
  { title: 'Fetal Medicine Foundation', url: 'https://www.fetalmedicine.org/website/' },
  { title: 'Perinatology.com calculators', url: 'https://perinatology.com/' },
];

/**
 * Links learners use beside a lesson, e.g. online calculators. Each can open
 * in a panel next to the lesson ("embed") or only in a new tab.
 */
export function ResourceLinksEditor({
  value,
  onChange,
  disabled,
}: {
  value: ResourceLink[];
  onChange: (links: ResourceLink[]) => void;
  disabled?: boolean;
}) {
  const t = useTranslations('Resources');
  const update = (index: number, patch: Partial<ResourceLink>) => onChange(value.map((link, i) => (i === index ? { ...link, ...patch } : link)));
  const add = (link?: { title: string; url: string }) =>
    onChange([...value, { id: newId('c'), title: link?.title ?? '', url: link?.url ?? 'https://', note: null, embed: true }]);
  const unused = SUGGESTIONS.filter((s) => !value.some((link) => link.url === s.url));

  return (
    <div className="flex flex-col gap-3">
      {value.map((link, index) => (
        <fieldset key={link.id} className="flex flex-col gap-2 rounded-xl border border-border p-3">
          <legend className="sr-only">{link.title || t('untitled')}</legend>
          <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_auto]">
            <Input aria-label={t('title')} placeholder={t('titlePlaceholder')} maxLength={120} disabled={disabled} value={link.title} onChange={(e) => update(index, { title: e.target.value })} />
            <Input aria-label={t('url')} type="url" inputMode="url" placeholder="https://" maxLength={2000} disabled={disabled} value={link.url} onChange={(e) => update(index, { url: e.target.value.trim() })} />
            <span className="flex items-center gap-1">
              <a href={link.url} target="_blank" rel="noopener noreferrer" aria-label={t('test', { title: link.title || link.url })} className="rounded p-2 text-muted-foreground hover:text-primary">
                <ExternalLink aria-hidden className="size-4" />
              </a>
              <button type="button" aria-label={t('remove', { title: link.title || link.url })} disabled={disabled} onClick={() => onChange(value.filter((_, i) => i !== index))} className="rounded p-2 text-muted-foreground hover:text-destructive">
                <Trash2 aria-hidden className="size-4" />
              </button>
            </span>
          </div>
          <Input aria-label={t('note')} placeholder={t('notePlaceholder')} maxLength={300} disabled={disabled} value={link.note ?? ''} onChange={(e) => update(index, { note: e.target.value || null })} />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" className="size-4 accent-[var(--primary)]" disabled={disabled} checked={link.embed} onChange={(e) => update(index, { embed: e.target.checked })} />
            {t('embed')}
          </label>
        </fieldset>
      ))}
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" size="sm" disabled={disabled || value.length >= 20} onClick={() => add()}>
          <Plus aria-hidden className="size-4" />
          {t('add')}
        </Button>
        {unused.map((s) => (
          <Button key={s.url} type="button" variant="ghost" size="sm" disabled={disabled || value.length >= 20} onClick={() => add(s)}>
            + {s.title}
          </Button>
        ))}
      </div>
    </div>
  );
}
