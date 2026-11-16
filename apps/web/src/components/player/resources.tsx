'use client';

import { type ResourceLink } from '@obgyn/types';
import { Calculator, ExternalLink, PanelRight, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';

interface PanelApi {
  resources: ResourceLink[];
  open: (id: string) => void;
}

const PanelContext = createContext<PanelApi>({ resources: [], open: () => undefined });

/** Open a lesson resource (e.g. a calculator) from anywhere inside the lesson. */
export const useResourcePanel = () => useContext(PanelContext);

/**
 * Lays the lesson out beside a resource panel. A calculator opens next to the
 * lesson (on phones: a sheet over the lower part of the screen), so learners
 * can read the case, calculate, and type the result back without losing either.
 */
export function ResourcePanelProvider({ resources, children }: { resources: ResourceLink[]; children: ReactNode }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const current = resources.find((r) => r.id === openId) ?? null;
  const open = (id: string) => {
    const link = resources.find((r) => r.id === id);
    if (!link) return;
    // Sites that can't be shown inside a page open in a new tab instead.
    if (link.embed) setOpenId(id);
    else window.open(link.url, '_blank', 'noopener,noreferrer');
  };

  return (
    <PanelContext.Provider value={{ resources, open }}>
      <div className={current ? 'mx-auto flex max-w-[1700px] flex-col gap-4 lg:flex-row lg:items-start' : undefined}>
        <div className="min-w-0 flex-1">{children}</div>
        {current ? <ResourcePanel link={current} onClose={() => setOpenId(null)} /> : null}
      </div>
    </PanelContext.Provider>
  );
}

function ResourcePanel({ link, onClose }: { link: ResourceLink; onClose: () => void }) {
  const t = useTranslations('Resources');
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => closeRef.current?.focus(), [link.id]);

  return (
    <aside
      aria-label={t('panelLabel', { title: link.title })}
      className="fixed inset-x-0 bottom-0 z-40 flex h-[70dvh] flex-col overflow-hidden rounded-t-2xl border border-border bg-card shadow-2xl lg:sticky lg:top-4 lg:z-auto lg:h-[calc(100dvh-2rem)] lg:w-[min(36vw,560px)] lg:shrink-0 lg:rounded-2xl lg:shadow-none"
      onKeyDown={(e) => e.key === 'Escape' && onClose()}
    >
      <div className="flex items-center gap-2 border-b border-border px-3 py-2">
        <Calculator aria-hidden className="size-4 shrink-0 text-primary" />
        <h2 className="min-w-0 flex-1 truncate text-sm font-semibold">{link.title}</h2>
        <a href={link.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 rounded px-2 py-1 text-xs text-primary hover:bg-primary-light">
          <ExternalLink aria-hidden className="size-3.5" />
          {t('newTab')}
        </a>
        <button ref={closeRef} type="button" aria-label={t('close')} onClick={onClose} className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground">
          <X aria-hidden className="size-4" />
        </button>
      </div>
      <iframe
        key={link.id}
        src={link.url}
        title={link.title}
        // An outside site: no access to our page, cookies or top window.
        sandbox="allow-scripts allow-forms allow-same-origin allow-popups allow-popups-to-escape-sandbox"
        referrerPolicy="no-referrer"
        className="min-h-0 w-full flex-1 bg-white"
      />
      <p className="border-t border-border px-3 py-1.5 text-xs text-muted-foreground">{t('notLoading')}</p>
    </aside>
  );
}

/** The lesson's resources as a list: open beside the lesson, or in a new tab. */
export function LessonResources() {
  const t = useTranslations('Resources');
  const { resources, open } = useResourcePanel();
  if (!resources.length) return null;
  return (
    <section aria-labelledby="lesson-resources" className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4">
      <h2 id="lesson-resources" className="flex items-center gap-2 font-semibold">
        <Calculator aria-hidden className="size-5 text-primary" />
        {t('heading')}
      </h2>
      <ul className="grid gap-2 sm:grid-cols-2">
        {resources.map((link) => (
          <li key={link.id} className="flex flex-col gap-2 rounded-xl border border-border p-3">
            <span className="font-medium">{link.title}</span>
            {link.note ? <span className="text-sm text-muted-foreground">{link.note}</span> : null}
            <span className="truncate text-xs text-muted-foreground">{new URL(link.url).hostname}</span>
            <span className="mt-auto flex flex-wrap gap-2">
              {link.embed ? (
                <button type="button" onClick={() => open(link.id)} className="flex items-center gap-1.5 rounded-[4px] bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary-hover">
                  <PanelRight aria-hidden className="size-4" />
                  {t('openBeside')}
                </button>
              ) : null}
              <a href={link.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 rounded-[4px] border border-border px-3 py-1.5 text-sm font-medium hover:border-primary">
                <ExternalLink aria-hidden className="size-4" />
                {t('newTab')}
              </a>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
