'use client';

import { Button, Input } from '@obgyn/ui';
import { Plus, X } from 'lucide-react';
import { useState } from 'react';

/** Editable list of short points (what you'll learn, requirements). */
export function ListEditor({
  id,
  label,
  items,
  onChange,
  placeholder,
  addLabel,
  removeLabel,
  max = 20,
}: {
  id: string;
  label: string;
  items: string[];
  onChange: (items: string[]) => void;
  placeholder: string;
  addLabel: string;
  removeLabel: string;
  max?: number;
}) {
  const [draft, setDraft] = useState('');
  const add = () => {
    const value = draft.trim();
    if (!value || items.includes(value) || items.length >= max) return;
    onChange([...items, value]);
    setDraft('');
  };
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 text-sm font-medium">{label}</legend>
      {items.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {items.map((item, index) => (
            <li key={item} className="flex items-center gap-2 rounded-md border border-border bg-muted/50 px-3 py-2 text-sm">
              <span className="flex-1">{item}</span>
              <button
                type="button"
                onClick={() => onChange(items.filter((_, i) => i !== index))}
                className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-destructive"
                aria-label={`${removeLabel}: ${item}`}
              >
                <X aria-hidden className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <div className="flex gap-2">
        <Input
          id={id}
          value={draft}
          maxLength={200}
          placeholder={placeholder}
          aria-label={`${label}: ${placeholder}`}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              add();
            }
          }}
        />
        <Button type="button" variant="outline" onClick={add} disabled={!draft.trim() || items.length >= max}>
          <Plus aria-hidden className="size-4" />
          {addLabel}
        </Button>
      </div>
    </fieldset>
  );
}

/** Tag chips with Enter-to-add. */
export function TagInput({
  id,
  label,
  hint,
  tags,
  onChange,
  removeLabel,
}: {
  id: string;
  label: string;
  hint: string;
  tags: string[];
  onChange: (tags: string[]) => void;
  removeLabel: string;
}) {
  const [draft, setDraft] = useState('');
  const add = () => {
    const value = draft.trim().toLowerCase().slice(0, 40);
    if (value && !tags.includes(value) && tags.length < 15) onChange([...tags, value]);
    setDraft('');
  };
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-sm font-medium">{label}</label>
      <div className="flex min-h-10 flex-wrap items-center gap-2 rounded-md border border-border bg-background p-2 focus-within:ring-2 focus-within:ring-ring">
        {tags.map((tag) => (
          <span key={tag} className="flex items-center gap-1 rounded-full bg-primary-light px-2.5 py-1 text-sm text-primary">
            {tag}
            <button type="button" onClick={() => onChange(tags.filter((t) => t !== tag))} aria-label={`${removeLabel}: ${tag}`}>
              <X aria-hidden className="size-3.5" />
            </button>
          </span>
        ))}
        <input
          id={id}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ',') {
              event.preventDefault();
              add();
            } else if (event.key === 'Backspace' && !draft && tags.length) {
              onChange(tags.slice(0, -1));
            }
          }}
          onBlur={add}
          aria-describedby={`${id}-hint`}
          className="min-w-32 flex-1 bg-transparent px-1 outline-none"
        />
      </div>
      <p id={`${id}-hint`} className="text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}
