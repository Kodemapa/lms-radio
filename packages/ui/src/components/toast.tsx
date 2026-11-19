'use client';

import { CheckCircle2, Info, X, XCircle } from 'lucide-react';
import { useEffect, useSyncExternalStore } from 'react';
import { cn } from '../lib/cn';

export type ToastTone = 'success' | 'error' | 'info';

export interface ToastItem {
  id: number;
  tone: ToastTone;
  message: string;
}

/** How long a toast stays on screen. Errors stay longer so they can be read. */
const DURATION: Record<ToastTone, number> = { success: 3500, info: 4000, error: 6000 };
/** Older toasts are dropped beyond this many. */
const MAX_VISIBLE = 4;

let items: ToastItem[] = [];
let nextId = 1;
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function show(tone: ToastTone, message: string): number {
  const id = nextId++;
  items = [...items, { id, tone, message }].slice(-MAX_VISIBLE);
  emit();
  return id;
}

export function dismissToast(id: number): void {
  items = items.filter((item) => item.id !== id);
  emit();
}

/**
 * Short confirmation after an action ("Course saved", "Lesson deleted").
 * Works from any client code; the `<Toaster />` in the root layout shows it.
 */
export const toast = Object.assign((message: string) => show('info', message), {
  success: (message: string) => show('success', message),
  error: (message: string) => show('error', message),
  info: (message: string) => show('info', message),
});

/** Test helper: the toasts currently queued. */
export function currentToasts(): readonly ToastItem[] {
  return items;
}

const EMPTY: ToastItem[] = [];

const ICONS = { success: CheckCircle2, error: XCircle, info: Info } as const;
const TONES: Record<ToastTone, string> = {
  success: 'border-success/30 [&_svg.tone]:text-success',
  error: 'border-destructive/40 [&_svg.tone]:text-destructive',
  info: 'border-primary/30 [&_svg.tone]:text-primary',
};

function ToastView({ item, closeLabel }: { item: ToastItem; closeLabel: string }) {
  useEffect(() => {
    const timer = setTimeout(() => dismissToast(item.id), DURATION[item.tone]);
    return () => clearTimeout(timer);
  }, [item.id, item.tone]);
  const Icon = ICONS[item.tone];
  return (
    <li
      className={cn(
        'pointer-events-auto flex w-full items-start gap-3 rounded-2xl border bg-card p-4 text-sm text-card-foreground shadow-lg',
        'toast-in',
        TONES[item.tone],
      )}
    >
      <Icon aria-hidden className="tone mt-0.5 size-5 shrink-0" />
      <p className="min-w-0 flex-1 font-medium">{item.message}</p>
      <button
        type="button"
        onClick={() => dismissToast(item.id)}
        aria-label={closeLabel}
        className="-m-1 rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
      >
        <X aria-hidden className="size-4" />
      </button>
    </li>
  );
}

/**
 * Renders queued toasts in the bottom corner. Errors are announced assertively,
 * everything else politely, so screen readers hear each one once.
 */
export function Toaster({ closeLabel = 'Dismiss' }: { closeLabel?: string }) {
  const list = useSyncExternalStore(subscribe, () => items, () => EMPTY);
  const errors = list.filter((item) => item.tone === 'error');
  const others = list.filter((item) => item.tone !== 'error');
  const region = 'pointer-events-none flex flex-col gap-2';
  return (
    <div className="fixed inset-x-4 bottom-4 z-[100] flex flex-col gap-2 sm:inset-x-auto sm:end-4 sm:w-[380px]">
      <ol aria-live="polite" className={region}>
        {others.map((item) => (
          <ToastView key={item.id} item={item} closeLabel={closeLabel} />
        ))}
      </ol>
      <ol role="alert" aria-live="assertive" className={region}>
        {errors.map((item) => (
          <ToastView key={item.id} item={item} closeLabel={closeLabel} />
        ))}
      </ol>
    </div>
  );
}
