'use client';

import { useEffect, useState } from 'react';
import { cn } from '../lib/cn';

export interface WatermarkProps {
  /** Identifying lines, e.g. display name, user ref, session ref. */
  lines: string[];
  /** How often the mark jumps to a new position. */
  moveEveryMs?: number;
  className?: string;
}

interface Position {
  top: number;
  left: number;
}

function randomPosition(): Position {
  return { top: 5 + Math.random() * 75, left: 5 + Math.random() * 60 };
}

/**
 * Dynamic forensic watermark (CLAUDE.md rule 3): shows who is watching and when,
 * and keeps moving so it cannot be cropped or masked out of a recording.
 * Renders a fixed position on the server to avoid hydration mismatches.
 */
export function Watermark({ lines, moveEveryMs = 4000, className }: WatermarkProps) {
  const [position, setPosition] = useState<Position>({ top: 10, left: 10 });
  const [timestamp, setTimestamp] = useState<string | null>(null);

  useEffect(() => {
    const tick = () => setTimestamp(new Date().toISOString().replace('T', ' ').slice(0, 19));
    tick();
    const clock = setInterval(tick, 1000);
    setPosition(randomPosition());
    const mover = setInterval(() => setPosition(randomPosition()), moveEveryMs);
    return () => {
      clearInterval(clock);
      clearInterval(mover);
    };
  }, [moveEveryMs]);

  return (
    <div
      aria-hidden="true"
      data-testid="watermark"
      className={cn('pointer-events-none absolute inset-0 z-50 select-none overflow-hidden', className)}
    >
      <div
        className="absolute -rotate-12 whitespace-nowrap font-mono text-xs leading-snug text-white opacity-40 mix-blend-difference transition-all duration-[1500ms] ease-in-out sm:text-sm"
        style={{ top: `${position.top}%`, left: `${position.left}%` }}
      >
        {lines.map((line) => (
          <div key={line}>{line}</div>
        ))}
        {timestamp ? <div>{timestamp} UTC</div> : null}
      </div>
    </div>
  );
}
