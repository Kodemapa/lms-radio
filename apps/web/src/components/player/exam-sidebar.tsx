'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

/**
 * Lets a running exam take over the course player's right-hand column (where "Course
 * content" normally is) for its question grid. The player shell provides the slot.
 */
interface ExamSidebar {
  /** Element in the right column to render into (null on small screens / not mounted). */
  target: HTMLElement | null;
  /** The exam is showing its grid there: hide the course content meanwhile. */
  setActive: (active: boolean) => void;
}

const ExamSidebarContext = createContext<ExamSidebar | null>(null);

export function ExamSidebarProvider({ value, children }: { value: ExamSidebar; children: ReactNode }) {
  return <ExamSidebarContext.Provider value={value}>{children}</ExamSidebarContext.Provider>;
}

/** True on screens wide enough to show the player's right column (Tailwind `lg`). */
function useWide(): boolean {
  const [wide, setWide] = useState(false);
  useEffect(() => {
    const query = window.matchMedia('(min-width: 1024px)');
    const update = () => setWide(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  return wide;
}

/**
 * Renders `children` in the player's right column on wide screens, or `fallback` in place
 * (e.g. below the question on phones, or when the page has no player column).
 */
export function InExamSidebar({ children, fallback }: { children: ReactNode; fallback: ReactNode }) {
  const sidebar = useContext(ExamSidebarContext);
  const wide = useWide();
  const target = wide ? (sidebar?.target ?? null) : null;
  const setActive = sidebar?.setActive;
  useEffect(() => {
    if (!target || !setActive) return;
    setActive(true);
    return () => setActive(false);
  }, [target, setActive]);
  return target ? createPortal(children, target) : <>{fallback}</>;
}
