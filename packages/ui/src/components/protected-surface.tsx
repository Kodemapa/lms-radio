'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { cn } from '../lib/cn';
import { Watermark } from './watermark';

/** Why protected content is currently blanked. */
export type ShieldReason = 'inactive' | 'capture' | 'print';

export interface ProtectedSurfaceProps {
  watermarkLines: string[];
  children: ReactNode;
  className?: string;
  /**
   * Blank the content when the window loses focus, on screenshot shortcuts and
   * when printing. Default true.
   */
  shield?: boolean;
  /** Called when the shield goes up (with the reason) or down (null). */
  onShieldChange?: (reason: ShieldReason | null) => void;
  /** Localised text shown on the shield. */
  shieldMessages?: Partial<Record<ShieldReason, string>>;
}

const DEFAULT_MESSAGES: Record<ShieldReason, string> = {
  inactive: 'Content is hidden while this window is not active.',
  capture: 'Screenshots and screen recording are not allowed. Click to continue.',
  print: 'Printing is not allowed.',
};

/** PrintScreen anywhere; ⌘⇧ (macOS ⌘⇧3/4/5) and Win+Shift (Windows Snipping Tool) modifier chords. */
export function isCaptureShortcut(event: Pick<KeyboardEvent, 'key' | 'metaKey' | 'shiftKey'>): boolean {
  if (event.key === 'PrintScreen' || event.key === 'Snapshot') return true;
  return event.metaKey && event.shiftKey;
}

/**
 * Wrapper for every protected view: blocks the casual save paths (context menu,
 * drag, copy, text selection), overlays the moving watermark, and blanks the
 * content when a capture looks likely.
 *
 * A browser cannot stop an OS-level screenshot; this is a deterrent. Real
 * blocking comes from hardware DRM (video) and the native apps' capture
 * protection — see docs/03-CONTENT-PROTECTION.md.
 */
export function ProtectedSurface({
  watermarkLines,
  children,
  className,
  shield = true,
  onShieldChange,
  shieldMessages,
}: ProtectedSurfaceProps) {
  const block = (event: { preventDefault(): void }) => event.preventDefault();
  const ref = useRef<HTMLDivElement>(null);
  const [reason, setReason] = useState<ShieldReason | null>(null);
  const notify = useRef(onShieldChange);
  notify.current = onShieldChange;

  useEffect(() => {
    notify.current?.(reason);
  }, [reason]);

  useEffect(() => {
    if (!shield) return;
    // A capture shield stays up until the learner clicks; focus can't lower it.
    const raise = (next: ShieldReason) => setReason((current) => (current === 'capture' ? current : next));
    const lowerInactive = () => setReason((current) => (current === 'inactive' ? null : current));

    const onBlur = () => {
      // Focus moving into our own iframe (PDF viewer) is not leaving the page.
      window.setTimeout(() => {
        const active = document.activeElement;
        if (active?.tagName === 'IFRAME' && ref.current?.contains(active)) return;
        if (!document.hasFocus()) raise('inactive');
      }, 0);
    };
    const onVisibility = () => (document.hidden ? raise('inactive') : lowerInactive());
    const onKey = (event: KeyboardEvent) => {
      if (!isCaptureShortcut(event)) return;
      setReason('capture');
      // PrintScreen copies to the clipboard on Windows; overwrite it where allowed.
      if (event.key === 'PrintScreen') void navigator.clipboard?.writeText('').catch(() => undefined);
    };
    const onBeforePrint = () => raise('print');
    const onAfterPrint = () => setReason((current) => (current === 'print' ? null : current));

    window.addEventListener('blur', onBlur);
    window.addEventListener('focus', lowerInactive);
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('keydown', onKey, true);
    window.addEventListener('keyup', onKey, true);
    window.addEventListener('beforeprint', onBeforePrint);
    window.addEventListener('afterprint', onAfterPrint);
    return () => {
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('focus', lowerInactive);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('keydown', onKey, true);
      window.removeEventListener('keyup', onKey, true);
      window.removeEventListener('beforeprint', onBeforePrint);
      window.removeEventListener('afterprint', onAfterPrint);
    };
  }, [shield]);

  const messages = { ...DEFAULT_MESSAGES, ...shieldMessages };
  return (
    <div
      ref={ref}
      className={cn('relative select-none overflow-hidden print:invisible', className)}
      onContextMenu={block}
      onDragStart={block}
      onCopy={block}
    >
      {children}
      <Watermark lines={watermarkLines} />
      {reason ? (
        <button
          type="button"
          data-testid="capture-shield"
          className="absolute inset-0 z-[60] flex items-center justify-center bg-black p-6 text-center text-sm text-white"
          onClick={() => setReason(null)}
        >
          {messages[reason]}
        </button>
      ) : null}
    </div>
  );
}
