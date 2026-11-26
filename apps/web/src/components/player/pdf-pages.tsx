'use client';

import { Button } from '@obgyn/ui';
import { ChevronDown, ChevronUp, Loader2, Maximize, Minimize, MoveHorizontal, ZoomIn, ZoomOut } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { PDFDocumentProxy, RenderTask } from 'pdfjs-dist';
import { useCallback, useEffect, useRef, useState } from 'react';

const ZOOMS = [0.5, 0.75, 1, 1.25, 1.5, 2, 2.5, 3] as const;
type Zoom = (typeof ZOOMS)[number];
/** Double-clicking a page zooms to this (and back to fit width). */
const PAGE_ZOOM: Zoom = 2;

async function loadPdfJs() {
  const pdfjs = await import('pdfjs-dist');
  // Served by app/api/pdf-worker (bundling the worker with webpack breaks the build).
  if (!pdfjs.GlobalWorkerOptions.workerSrc) pdfjs.GlobalWorkerOptions.workerSrc = '/api/pdf-worker';
  return pdfjs;
}

/** One page, drawn to a canvas only once it is near the visible area. */
function PdfPage({
  doc,
  pageNumber,
  width,
  label,
  register,
  onDoubleClick,
}: {
  doc: PDFDocumentProxy;
  pageNumber: number;
  width: number;
  label: string;
  register: (pageNumber: number, element: HTMLDivElement | null) => void;
  onDoubleClick: () => void;
}) {
  const holder = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [visible, setVisible] = useState(pageNumber <= 2);
  const [ratio, setRatio] = useState(1.414); // A4 until the page says otherwise

  useEffect(() => {
    const element = holder.current;
    if (!element || visible) return;
    const observer = new IntersectionObserver((entries) => entries.some((e) => e.isIntersecting) && setVisible(true), {
      rootMargin: '600px 0px',
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [visible]);

  useEffect(() => {
    if (!visible || !width) return;
    let task: RenderTask | null = null;
    let cancelled = false;
    void (async () => {
      const page = await doc.getPage(pageNumber);
      if (cancelled) return;
      const base = page.getViewport({ scale: 1 });
      setRatio(base.height / base.width);
      const scale = width / base.width;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const viewport = page.getViewport({ scale: scale * dpr });
      const target = canvas.current;
      const context = target?.getContext('2d');
      if (!target || !context) return;
      target.width = Math.floor(viewport.width);
      target.height = Math.floor(viewport.height);
      task = page.render({ canvasContext: context, viewport });
      await task.promise.catch(() => undefined);
    })();
    return () => {
      cancelled = true;
      task?.cancel();
    };
  }, [doc, pageNumber, visible, width]);

  return (
    <div
      ref={(element) => {
        holder.current = element;
        register(pageNumber, element);
      }}
      data-page={pageNumber}
      role="img"
      aria-label={label}
      onDoubleClick={onDoubleClick}
      className="mx-auto shrink-0 cursor-zoom-in bg-white shadow-sm ring-1 ring-border"
      style={{ width, height: Math.round(width * ratio) }}
    >
      <canvas ref={canvas} className="block size-full" />
    </div>
  );
}

/**
 * Renders a PDF page by page with pdf.js (no browser viewer, so no download or
 * print button), with a toolbar: previous/next page, "Page X of Y" and zoom.
 */
export function PdfPages({ url, title, onError }: { url: string; title: string; onError: () => void }) {
  const t = useTranslations('Player.pdf');
  const scroller = useRef<HTMLDivElement>(null);
  const pages = useRef(new Map<number, HTMLDivElement>());
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [current, setCurrent] = useState(1);
  const [zoom, setZoom] = useState<Zoom>(1);
  const root = useRef<HTMLDivElement>(null);
  const [fullscreen, setFullscreen] = useState(false);
  // The page to keep in view while the zoom changes.
  const anchorPage = useRef(1);
  const [containerWidth, setContainerWidth] = useState(0);
  const [pageInput, setPageInput] = useState('1');
  const currentRef = useRef(1);
  currentRef.current = current;
  const failed = useRef(onError);
  failed.current = onError;

  useEffect(() => {
    let cancelled = false;
    let loaded: PDFDocumentProxy | null = null;
    void (async () => {
      try {
        const pdfjs = await loadPdfJs();
        // The signed URL is the permission; no cookies needed (and none sent cross-origin).
        const res = await fetch(url, { credentials: 'omit' });
        if (!res.ok) throw new Error(String(res.status));
        const data = new Uint8Array(await res.arrayBuffer());
        loaded = await pdfjs.getDocument({ data, isEvalSupported: false }).promise;
        if (cancelled) void loaded.destroy();
        else setDoc(loaded);
      } catch {
        if (!cancelled) failed.current();
      }
    })();
    return () => {
      cancelled = true;
      void loaded?.destroy();
    };
  }, [url]);

  useEffect(() => {
    const element = scroller.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => setContainerWidth(Math.floor(entry!.contentRect.width)));
    observer.observe(element);
    return () => observer.disconnect();
  }, [doc]);

  // After a zoom change, bring the page that was being read back into view.
  useEffect(() => {
    const element = scroller.current;
    const page = pages.current.get(anchorPage.current);
    if (element && page) element.scrollTop = page.offsetTop - 12;
  }, [zoom]);

  const changeZoom = useCallback((next: Zoom, page?: number) => {
    anchorPage.current = page ?? currentRef.current;
    setZoom(next);
  }, []);

  // Trackpad pinch / Ctrl (⌘) + wheel zooms the document, not the whole web page.
  useEffect(() => {
    const element = scroller.current;
    if (!element) return;
    let last = 0;
    const onWheel = (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      const now = Date.now();
      if (now - last < 120) return;
      last = now;
      setZoom((current) => {
        const index = ZOOMS.indexOf(current) + (event.deltaY < 0 ? 1 : -1);
        anchorPage.current = currentRef.current;
        return ZOOMS[Math.min(Math.max(0, index), ZOOMS.length - 1)]!;
      });
    };
    element.addEventListener('wheel', onWheel, { passive: false });
    return () => element.removeEventListener('wheel', onWheel);
  }, [doc]);

  // Full screen keeps the watermark: the whole protected surface goes full screen.
  useEffect(() => {
    const update = () => setFullscreen(!!document.fullscreenElement && !!root.current && document.fullscreenElement.contains(root.current));
    document.addEventListener('fullscreenchange', update);
    return () => document.removeEventListener('fullscreenchange', update);
  }, []);
  const toggleFullscreen = () => {
    const surface = root.current?.parentElement;
    if (!surface) return;
    anchorPage.current = currentRef.current;
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
    else void surface.requestFullscreen?.().catch(() => undefined);
  };

  // The page whose top is nearest the top of the view is the current page.
  const onScroll = useCallback(() => {
    const element = scroller.current;
    if (!element) return;
    const top = element.getBoundingClientRect().top;
    let best = 1;
    for (const [number, page] of pages.current) {
      if (page.getBoundingClientRect().top - top <= element.clientHeight * 0.4) best = Math.max(best, number);
    }
    setCurrent(best);
    setPageInput(String(best));
  }, []);

  const register = useCallback((number: number, element: HTMLDivElement | null) => {
    if (element) pages.current.set(number, element);
    else pages.current.delete(number);
  }, []);

  const goTo = (number: number) => {
    if (!doc) return;
    const target = Math.min(Math.max(1, number), doc.numPages);
    const element = scroller.current;
    const page = pages.current.get(target);
    if (element && page) element.scrollTo({ top: page.offsetTop - 12, behavior: 'smooth' });
    setCurrent(target);
    setPageInput(String(target));
  };

  if (!doc) {
    return (
      <div role="status" className="grid size-full place-items-center gap-2 text-sm text-muted-foreground">
        <span className="flex items-center gap-2">
          <Loader2 aria-hidden className="size-4 animate-spin" />
          {t('loading')}
        </span>
      </div>
    );
  }

  const total = doc.numPages;
  const pageWidth = Math.max(200, Math.floor((containerWidth - 24) * zoom));
  const zoomIndex = ZOOMS.indexOf(zoom);

  return (
    <div ref={root} className="flex size-full flex-col bg-white">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-card px-3 py-2">
        <div className="flex items-center gap-1">
          <Button type="button" size="sm" variant="outline" disabled={current <= 1} onClick={() => goTo(current - 1)} aria-label={t('previous')}>
            <ChevronUp aria-hidden className="size-4" />
            <span className="hidden sm:inline">{t('previous')}</span>
          </Button>
          <form
            className="flex items-center gap-1.5 px-1 text-sm"
            onSubmit={(event) => {
              event.preventDefault();
              goTo(Number(pageInput) || current);
            }}
          >
            <label htmlFor="pdf-page" className="text-muted-foreground">{t('page')}</label>
            <input
              id="pdf-page"
              inputMode="numeric"
              value={pageInput}
              onChange={(event) => setPageInput(event.target.value.replace(/\D/g, '').slice(0, 5))}
              onBlur={() => setPageInput(String(current))}
              className="w-12 rounded-md border border-border bg-background px-1.5 py-1 text-center"
            />
            <span className="text-muted-foreground">{t('of', { total })}</span>
          </form>
          <Button type="button" size="sm" variant="outline" disabled={current >= total} onClick={() => goTo(current + 1)} aria-label={t('next')}>
            <span className="hidden sm:inline">{t('next')}</span>
            <ChevronDown aria-hidden className="size-4" />
          </Button>
        </div>
        <div className="flex items-center gap-1">
          <Button type="button" size="sm" variant="ghost" disabled={zoomIndex <= 0} onClick={() => changeZoom(ZOOMS[zoomIndex - 1]!)} aria-label={t('zoomOut')}>
            <ZoomOut aria-hidden className="size-4" />
          </Button>
          <span className="w-12 text-center text-sm tabular-nums text-muted-foreground" aria-live="polite">{Math.round(zoom * 100)}%</span>
          <Button type="button" size="sm" variant="ghost" disabled={zoomIndex >= ZOOMS.length - 1} onClick={() => changeZoom(ZOOMS[zoomIndex + 1]!)} aria-label={t('zoomIn')}>
            <ZoomIn aria-hidden className="size-4" />
          </Button>
          <Button type="button" size="sm" variant="ghost" disabled={zoom === 1} onClick={() => changeZoom(1)} aria-label={t('fitWidth')} title={t('fitWidth')}>
            <MoveHorizontal aria-hidden className="size-4" />
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={toggleFullscreen} aria-label={fullscreen ? t('exitFullscreen') : t('fullscreen')} title={fullscreen ? t('exitFullscreen') : t('fullscreen')}>
            {fullscreen ? <Minimize aria-hidden className="size-4" /> : <Maximize aria-hidden className="size-4" />}
          </Button>
        </div>
      </div>
      <div
        ref={scroller}
        onScroll={onScroll}
        tabIndex={0}
        aria-label={t('documentLabel', { title, total })}
        className="flex-1 overflow-auto bg-muted/60 p-3 outline-none focus-visible:ring-2 focus-visible:ring-ring"
        onKeyDown={(event) => {
          if (event.key === 'PageDown' || (event.key === 'ArrowRight' && !event.shiftKey)) {
            event.preventDefault();
            goTo(current + 1);
          } else if (event.key === 'PageUp' || event.key === 'ArrowLeft') {
            event.preventDefault();
            goTo(current - 1);
          }
        }}
      >
        {/* w-max + min-w-full: a zoomed page wider than the view can be scrolled to both edges
            (centring it in a plain flex column would cut off its left side). */}
        <div className="flex w-max min-w-full flex-col items-center gap-3">
          {Array.from({ length: total }, (_, index) => (
            <PdfPage
              key={index + 1}
              doc={doc}
              pageNumber={index + 1}
              width={pageWidth}
              label={t('pageLabel', { page: index + 1, total })}
              register={register}
              onDoubleClick={() => changeZoom(zoom === 1 ? PAGE_ZOOM : 1, index + 1)}
            />
          ))}
        </div>
      </div>
      <p className="border-t border-border bg-card px-3 py-1.5 text-center text-xs text-muted-foreground">
        {total > 1 ? (current < total ? t('moreBelow', { remaining: total - current }) : t('lastPage')) : null}
        <span className="hidden sm:inline">{total > 1 ? ' · ' : ''}{t('zoomHint')}</span>
      </p>
    </div>
  );
}
