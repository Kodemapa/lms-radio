'use client';

import { measureMm } from '@obgyn/dicom';
import {
  conceptByKey,
  findTerm,
  isMeasuringTool,
  SignedMediaUrlSchema,
  type AnnotationTerm,
  type AnnotationTool,
  type ImagingImage,
  type Point,
  type SignedMediaUrl,
} from '@obgyn/types';
import { ProtectedSurface } from '@obgyn/ui';
import { BookOpen, Circle, Contrast, Crosshair, Hand, Minus, Pentagon, RotateCcw, Square, Trash2, ZoomIn } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { bffFetch } from '@/lib/client-fetch';
import { DicomViewer, type OverlayShape, type ViewerMode } from './dicom-viewer';

export interface DrawnAnnotation {
  id: string;
  assetId: string;
  frame: number;
  tool: AnnotationTool;
  coords: Point[];
  /** Free text; should be one of the dictionary abbreviations. */
  label: string;
}

export interface ReferenceDrawing {
  assetId: string;
  frame: number;
  label: string;
  tool: AnnotationTool;
  coords: Point[];
}

/** Value in mm of a caliper/ellipse on a calibrated image, else null. */
export function valueOf(annotation: Pick<DrawnAnnotation, 'tool' | 'coords'>, image: ImagingImage | undefined): number | null {
  return image?.calibration && isMeasuringTool(annotation.tool) ? measureMm(annotation.tool, annotation.coords, image.calibration) : null;
}

/** Name for a label: the dictionary term, else a built-in biometry concept. */
export function termName(label: string, dictionary: readonly AnnotationTerm[]): string | null {
  return findTerm(label, dictionary)?.name ?? conceptByKey(label.trim().toUpperCase())?.label ?? null;
}

let counter = 0;
export const newId = (prefix = 'm') => `${prefix}${Date.now().toString(36).slice(-5)}${(counter++).toString(36)}`;

/** Short-lived signed URLs, refreshed when older than 4 minutes (they live 5). */
function useSignedUrl(assetId: string | undefined) {
  const cache = useRef(new Map<string, { url: SignedMediaUrl; at: number }>());
  const [state, setState] = useState<{ assetId: string; url: SignedMediaUrl } | { assetId: string; error: true } | null>(null);
  useEffect(() => {
    if (!assetId) return;
    const cached = cache.current.get(assetId);
    if (cached && Date.now() - cached.at < 4 * 60_000) {
      setState({ assetId, url: cached.url });
      return;
    }
    let cancelled = false;
    bffFetch(`/api/proxy/media/${assetId}/url`)
      .then(async (res) => {
        if (!res.ok) throw new Error(String(res.status));
        const url = SignedMediaUrlSchema.parse(await res.json());
        cache.current.set(assetId, { url, at: Date.now() });
        if (!cancelled) setState({ assetId, url });
      })
      .catch(() => !cancelled && setState({ assetId, error: true }));
    return () => {
      cancelled = true;
    };
  }, [assetId]);
  return state && state.assetId === assetId ? state : null;
}

const VIEW_TOOLS: { mode: ViewerMode; icon: typeof Hand; key: string }[] = [
  { mode: 'pan', icon: Hand, key: 'toolPan' },
  { mode: 'zoom', icon: ZoomIn, key: 'toolZoom' },
  { mode: 'contrast', icon: Contrast, key: 'toolContrast' },
];
const ANNOTATION_TOOL_BUTTONS: { mode: AnnotationTool; icon: typeof Hand; key: string }[] = [
  { mode: 'POINT', icon: Crosshair, key: 'toolPoint' },
  { mode: 'BOX', icon: Square, key: 'toolBox' },
  { mode: 'POLYGON', icon: Pentagon, key: 'toolPolygon' },
  { mode: 'LENGTH', icon: Minus, key: 'toolLength' },
  { mode: 'ELLIPSE', icon: Circle, key: 'toolEllipse' },
];

/** Searchable shorthand dictionary: which label to use for what. */
export function DictionaryPanel({ dictionary, open = false }: { dictionary: readonly AnnotationTerm[]; open?: boolean }) {
  const t = useTranslations('Imaging');
  const [query, setQuery] = useState('');
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? dictionary.filter((term) => `${term.abbr} ${term.name} ${term.description ?? ''}`.toLowerCase().includes(q)) : dictionary;
  }, [dictionary, query]);
  if (dictionary.length === 0) return null;
  return (
    <details open={open} className="rounded-lg border border-border p-3 text-sm">
      <summary className="flex cursor-pointer items-center gap-2 font-semibold">
        <BookOpen aria-hidden className="size-4" />
        {t('dictionaryTitle', { count: dictionary.length })}
      </summary>
      <p className="mt-2 text-xs text-muted-foreground">{t('dictionaryHint')}</p>
      {dictionary.length > 8 ? (
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('dictionarySearch')}
          aria-label={t('dictionarySearch')}
          className="mt-2 w-full rounded-[4px] border border-border bg-background px-2 py-1"
        />
      ) : null}
      <dl className="mt-2 flex max-h-64 flex-col gap-1.5 overflow-y-auto">
        {shown.map((term) => (
          <div key={term.abbr} className="grid grid-cols-[minmax(3.5rem,auto)_1fr] gap-2">
            <dt className="font-mono font-semibold">{term.abbr}</dt>
            <dd>
              {term.name}
              {term.tools.length ? <span className="text-muted-foreground"> · {term.tools.map((tool) => t(`tool.${tool}`)).join(', ')}</span> : null}
              {term.description ? <span className="block text-xs text-muted-foreground">{term.description}</span> : null}
            </dd>
          </div>
        ))}
      </dl>
    </details>
  );
}

/**
 * The shared DICOM workspace: faculty draw the answer in it, learners make
 * theirs. Images stay inside the protected surface (watermark, capture
 * shield) and are only fetched through signed, session-bound URLs.
 */
export function ImagingWorkspace({
  images,
  annotations,
  onChange,
  references = [],
  editable,
  dictionary,
  suggestLabel,
  renderExtras,
  sidebarTop,
}: {
  images: ImagingImage[];
  annotations: DrawnAnnotation[];
  onChange?: (next: DrawnAnnotation[]) => void;
  /** Read-only drawings (the answer after submitting), shown dashed green. */
  references?: ReferenceDrawing[];
  editable: boolean;
  dictionary: readonly AnnotationTerm[];
  /** Pre-fills the label of a new drawing (e.g. the one open task for this tool). */
  suggestLabel?: (tool: AnnotationTool, assetId: string) => string;
  /** Extra controls per annotation (faculty: tolerances). */
  renderExtras?: (annotation: DrawnAnnotation, update: (patch: Partial<DrawnAnnotation>) => void) => ReactNode;
  sidebarTop?: ReactNode;
}) {
  const t = useTranslations('Imaging');
  const listId = useId();
  const [assetId, setAssetId] = useState(images[0]?.assetId);
  const [frame, setFrame] = useState(1);
  const [mode, setMode] = useState<ViewerMode>('pan');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [reset, setReset] = useState(0);
  const image = images.find((i) => i.assetId === assetId) ?? images[0];
  const signed = useSignedUrl(image?.assetId);

  useEffect(() => {
    if (!images.some((i) => i.assetId === assetId)) setAssetId(images[0]?.assetId);
  }, [images, assetId]);
  useEffect(() => setFrame(1), [image?.assetId]);

  const update = useCallback(
    (id: string, patch: Partial<DrawnAnnotation>) => onChange?.(annotations.map((a) => (a.id === id ? { ...a, ...patch } : a))),
    [annotations, onChange],
  );

  if (!image) return <p className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">{t('noImages')}</p>;

  const shapeLabel = (a: Pick<DrawnAnnotation, 'tool' | 'coords' | 'label'>) => {
    const value = valueOf(a, image);
    const name = a.label.trim() || t(`tool.${a.tool}`);
    return value === null ? name : `${name} ${value.toFixed(1)} mm`;
  };

  const here = (a: { assetId: string; frame: number }) => a.assetId === image.assetId && a.frame === frame;
  const shapes: OverlayShape[] = [
    ...references.filter(here).map((r, i) => ({ id: `ref${i}`, tool: r.tool, coords: r.coords, label: `${r.label} ✓`, tone: 'reference' as const, editable: false })),
    ...annotations.filter(here).map((a) => ({ id: a.id, tool: a.tool, coords: a.coords, label: shapeLabel(a), tone: 'mine' as const, editable })),
  ];

  const create = (tool: AnnotationTool, coords: Point[]) => {
    const annotation: DrawnAnnotation = { id: newId(), assetId: image.assetId, frame, tool, coords, label: suggestLabel?.(tool, image.assetId) ?? '' };
    onChange?.([...annotations, annotation]);
    setSelectedId(annotation.id);
  };

  const calibrated = !!image.calibration;

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="flex min-w-0 flex-col gap-2">
        {images.length > 1 ? (
          <div role="tablist" aria-label={t('images')} className="flex flex-wrap gap-1.5">
            {images.map((i, index) => (
              <button
                key={i.assetId}
                type="button"
                role="tab"
                aria-selected={i.assetId === image.assetId}
                onClick={() => setAssetId(i.assetId)}
                className={`rounded-[4px] border px-3 py-1.5 text-sm ${i.assetId === image.assetId ? 'border-primary bg-primary text-primary-foreground' : 'border-border hover:bg-muted'}`}
              >
                {index + 1}. {i.label}
              </button>
            ))}
          </div>
        ) : null}
        <div role="toolbar" aria-label={t('tools')} className="flex flex-wrap items-center gap-1.5">
          {[...VIEW_TOOLS, ...(editable ? ANNOTATION_TOOL_BUTTONS : [])].map(({ mode: m, icon: Icon, key }) => {
            // Calipers and ellipses need pixel spacing; pins, boxes and outlines don't.
            const needsCalibration = m === 'LENGTH' || m === 'ELLIPSE';
            return (
              <button
                key={m}
                type="button"
                aria-pressed={mode === m}
                disabled={needsCalibration && !calibrated}
                onClick={() => setMode(m)}
                title={needsCalibration && !calibrated ? t('uncalibrated') : t(key)}
                className={`flex items-center gap-1.5 rounded-[4px] border px-2.5 py-1.5 text-sm disabled:opacity-40 ${mode === m ? 'border-primary bg-primary-light text-primary' : 'border-border hover:bg-muted'}`}
              >
                <Icon aria-hidden className="size-4" />
                {t(key)}
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => setReset((n) => n + 1)}
            className="flex items-center gap-1.5 rounded-[4px] border border-border px-2.5 py-1.5 text-sm hover:bg-muted"
          >
            <RotateCcw aria-hidden className="size-4" />
            {t('resetView')}
          </button>
        </div>
        {mode === 'POLYGON' ? <p className="text-xs text-muted-foreground">{t('polygonHint')}</p> : null}
        <ProtectedSurface
          className="h-[min(70vh,640px)] rounded-lg bg-black"
          watermarkLines={signed && 'url' in signed ? [signed.url.watermark.displayName, `u:${signed.url.watermark.userRef} s:${signed.url.watermark.sessionRef}`] : []}
          shieldMessages={{ inactive: t('shieldInactive'), capture: t('shieldCapture'), print: t('shieldPrint') }}
        >
          {signed && 'url' in signed ? (
            <DicomViewer
              imageUrl={signed.url.url}
              frames={image.frames}
              frame={frame}
              onFrameChange={setFrame}
              mode={mode}
              shapes={shapes}
              selectedId={selectedId}
              onSelect={setSelectedId}
              onCreate={editable ? create : undefined}
              onUpdate={editable ? (id, coords) => update(id, { coords }) : undefined}
              onDelete={editable ? (id) => onChange?.(annotations.filter((a) => a.id !== id)) : undefined}
              resetSignal={reset}
              ariaLabel={t('viewerLabel', { label: image.label })}
              loadingText={t('loadingImage')}
              errorText={t('imageError')}
            />
          ) : (
            <p role="status" className="flex size-full items-center justify-center text-sm text-white/80">
              {signed ? t('imageError') : t('loadingImage')}
            </p>
          )}
        </ProtectedSurface>
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
          <span>
            {image.calibration ? t('calibrated', { mm: image.calibration.mmPerPxX.toFixed(3) }) : t('uncalibrated')}
            {image.modality ? ` · ${image.modality}` : ''} · {image.columns}×{image.rows}
          </span>
          {image.frames > 1 ? (
            <label className="flex items-center gap-2">
              {t('frame', { frame, total: image.frames })}
              <input type="range" min={1} max={image.frames} value={frame} onChange={(e) => setFrame(Number(e.target.value))} className="w-40" />
            </label>
          ) : null}
          <span>{t('mouseHint')}</span>
        </div>
      </div>

      <aside className="flex flex-col gap-3">
        {sidebarTop}
        <DictionaryPanel dictionary={dictionary} />
        <datalist id={listId}>
          {dictionary.map((term) => (
            <option key={term.abbr} value={term.abbr}>
              {term.name}
            </option>
          ))}
        </datalist>
        <h3 className="text-sm font-semibold">{t('annotations')}</h3>
        {annotations.length === 0 ? <p className="text-sm text-muted-foreground">{editable ? t('drawHint') : t('none')}</p> : null}
        <ul className="flex flex-col gap-2">
          {annotations.map((a) => {
            const onImage = images.find((i) => i.assetId === a.assetId);
            const value = valueOf(a, onImage);
            const selected = a.id === selectedId;
            const name = a.label.trim() ? termName(a.label, dictionary) : null;
            const inDictionary = !!findTerm(a.label, dictionary);
            return (
              <li
                key={a.id}
                className={`rounded-lg border p-2.5 text-sm ${selected ? 'border-primary bg-primary-light' : 'border-border'}`}
                onClick={() => {
                  setSelectedId(a.id);
                  setAssetId(a.assetId);
                  setFrame(a.frame);
                }}
              >
                <div className="flex items-center gap-2">
                  <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-xs">{t(`tool.${a.tool}`)}</span>
                  {editable ? (
                    <input
                      aria-label={t('labelAnnotation')}
                      list={listId}
                      value={a.label}
                      maxLength={16}
                      placeholder={t('labelPlaceholder')}
                      onChange={(e) => update(a.id, { label: e.target.value })}
                      onClick={(e) => e.stopPropagation()}
                      className="min-w-0 flex-1 rounded-[4px] border border-border bg-background px-2 py-1 font-mono uppercase"
                    />
                  ) : (
                    <span className="flex-1 font-mono font-medium">{a.label || t('unlabelled')}</span>
                  )}
                  {value !== null ? <span className="tabular-nums">{value.toFixed(1)} mm</span> : null}
                  {editable ? (
                    <button
                      type="button"
                      aria-label={t('delete')}
                      onClick={(e) => {
                        e.stopPropagation();
                        onChange?.(annotations.filter((x) => x.id !== a.id));
                      }}
                      className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-destructive"
                    >
                      <Trash2 aria-hidden className="size-4" />
                    </button>
                  ) : null}
                </div>
                {a.label.trim() ? (
                  <p className={`mt-1 text-xs ${inDictionary || name ? 'text-muted-foreground' : 'text-amber-700 dark:text-amber-400'}`}>
                    {name ?? t('notInDictionary')}
                  </p>
                ) : null}
                {images.length > 1 || (onImage?.frames ?? 1) > 1 ? (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {onImage?.label}
                    {(onImage?.frames ?? 1) > 1 ? ` · ${t('frame', { frame: a.frame, total: onImage!.frames })}` : ''}
                  </p>
                ) : null}
                {renderExtras ? (
                  <div className="mt-2" onClick={(e) => e.stopPropagation()}>
                    {renderExtras(a, (patch) => update(a.id, patch))}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      </aside>
    </div>
  );
}
