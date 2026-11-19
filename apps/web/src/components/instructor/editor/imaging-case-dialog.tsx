'use client';

import {
  DicomImageMetaSchema,
  ImagingCaseInputSchema,
  InstructorImagingCaseSchema,
  isMeasuringTool,
  isRegionTool,
  REPORT_UNITS,
  SignedMediaUrlSchema,
  type AnnotationTerm,
  type AnnotationTool,
  type FindingKey,
  type ImagingCaseInput,
  type ImagingImage,
  type ReportFieldKey,
  DEFAULT_WORKING,
  WORKING_MODES,
  type ResourceLink,
  type WorkingSettings,
} from '@obgyn/types';
import { Button, Dialog, DialogContent, DialogHeader, DialogTitle, Input, Label, Textarea, toast } from '@obgyn/ui';
import { AlertTriangle, Download, Plus, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { ImagingWorkspace, newId, valueOf, type DrawnAnnotation } from '@/components/imaging/imaging-workspace';
import { bffFetch } from '@/lib/client-fetch';
import { api, ApiClientError } from '@/lib/instructor-api';
import { DictionaryEditor } from './dictionary-editor';
import { FileUpload } from './file-upload';
import { ResourceLinksEditor } from './resource-links-editor';
import { useConfirmDelete } from '../confirm-dialog';

interface Rule {
  valueToleranceMm: number | null;
  valueTolerancePercent: number | null;
  positionToleranceMm: number | null;
  radiusPercent: number | null;
  iouFull: number | null;
  iouHalf: number | null;
  marks: number;
  teachingPoint: string | null;
}

/**
 * Starting values from the course's image-task plan (±10% for measurements,
 * pin radius 5% of image width, overlap 0.5 for full / 0.3 for half marks).
 * Faculty change them per item.
 */
function defaultRule(tool: AnnotationTool): Rule {
  const base: Rule = { valueToleranceMm: null, valueTolerancePercent: null, positionToleranceMm: null, radiusPercent: null, iouFull: null, iouHalf: null, marks: 1, teachingPoint: null };
  if (isMeasuringTool(tool)) return { ...base, valueTolerancePercent: 10 };
  if (tool === 'POINT') return { ...base, radiusPercent: 5 };
  return { ...base, iouFull: 0.5, iouHalf: 0.3 };
}

/** Sets an image's scale (mm per pixel); screenshots and other images without pixel spacing need it before calipers can be used. */
function ScaleControl({ image, disabled, onCalibrated }: { image: ImagingImage; disabled: boolean; onCalibrated: (meta: ImagingImage) => void }) {
  const t = useTranslations('Imaging');
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const apply = async () => {
    setError(null);
    try {
      const meta = DicomImageMetaSchema.parse(await api('PUT', `instructor/media/${image.assetId}/calibration`, { mmPerPx: Number(value) }));
      onCalibrated({ ...image, ...meta });
      setValue('');
    } catch (e) {
      setError(e instanceof ApiClientError && e.messageText ? e.messageText : t('saveFailed'));
    }
  };
  return (
    <span className="flex flex-wrap items-center gap-1.5 text-xs">
      <Input
        type="number"
        min={0}
        step="any"
        aria-label={t('scaleLabel')}
        placeholder={t('scalePlaceholder')}
        value={value}
        disabled={disabled}
        onChange={(e) => setValue(e.target.value)}
        className="h-8 w-28"
      />
      <Button size="sm" variant="outline" disabled={disabled || !(Number(value) > 0)} onClick={() => void apply()}>
        {t('setScale')}
      </Button>
      {error ? <span role="alert" className="text-destructive">{error}</span> : null}
    </span>
  );
}

const num = (value: string): number | null => (value.trim() === '' || !Number.isFinite(Number(value)) ? null : Number(value));
const clampMarks = (value: string) => Math.max(1, Math.min(100, Number(value) || 1));

/**
 * Faculty editor for an IMAGING lesson: the course's shorthand dictionary,
 * DICOM images, the answer key (pins, regions, calipers, ellipses with their
 * tolerances and teaching points), findings questions and report values.
 * Saving regenerates the reference DICOM SR.
 */
export function ImagingCaseDialog({
  courseId,
  lessonId,
  lessonTitle,
  locked,
  onClose,
}: {
  courseId: string;
  lessonId: string;
  lessonTitle: string;
  locked: boolean;
  onClose: () => void;
}) {
  const t = useTranslations('Imaging');
  const tCommon = useTranslations('Common');
  const [loaded, setLoaded] = useState(false);
  const [instructions, setInstructions] = useState('');
  const [images, setImages] = useState<ImagingImage[]>([]);
  const [annotations, setAnnotations] = useState<DrawnAnnotation[]>([]);
  const [rules, setRules] = useState<Record<string, Rule>>({});
  const [findings, setFindings] = useState<FindingKey[]>([]);
  const [fields, setFields] = useState<ReportFieldKey[]>([]);
  const [resources, setResources] = useState<ResourceLink[]>([]);
  const [working, setWorking] = useState<WorkingSettings>(DEFAULT_WORKING);
  const [dictionary, setDictionary] = useState<AnnotationTerm[]>([]);
  const [referenceSr, setReferenceSr] = useState<string | null>(null);
  const [status, setStatus] = useState<{ kind: 'saving' | 'saved' } | { kind: 'error'; message: string } | null>(null);

  const apply = (data: unknown) => {
    const value = InstructorImagingCaseSchema.parse(data);
    setInstructions(value.instructions);
    setImages(value.images);
    setAnnotations(value.annotations.map((a) => ({ id: a.id, assetId: a.assetId, frame: a.frame, tool: a.tool, coords: a.coords, label: a.label })));
    setRules(
      Object.fromEntries(
        value.annotations.map((a) => [
          a.id,
          {
            valueToleranceMm: a.valueToleranceMm,
            valueTolerancePercent: a.valueTolerancePercent,
            positionToleranceMm: a.positionToleranceMm,
            radiusPercent: a.radiusPercent,
            iouFull: a.iouFull,
            iouHalf: a.iouHalf,
            marks: a.marks,
            teachingPoint: a.teachingPoint,
          },
        ]),
      ),
    );
    setFindings(value.findings);
    setFields(value.reportFields);
    setResources(value.resources);
    setWorking(value.working);
    setReferenceSr(value.referenceSrAssetId);
  };

  useEffect(() => {
    api('GET', `instructor/lessons/${lessonId}/imaging`)
      .then(apply)
      .catch(() => setStatus({ kind: 'error', message: t('loadFailed') }))
      .finally(() => setLoaded(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lessonId]);

  const ruleOf = (a: Pick<DrawnAnnotation, 'id' | 'tool'>) => rules[a.id] ?? defaultRule(a.tool);
  const setRule = (a: Pick<DrawnAnnotation, 'id' | 'tool'>, patch: Partial<Rule>) => setRules((current) => ({ ...current, [a.id]: { ...ruleOf(a), ...patch } }));

  const toInput = (): ImagingCaseInput => ({
    instructions,
    images: images.map((i) => ({ assetId: i.assetId, label: i.label })),
    annotations: annotations.map((a) => ({ id: a.id, label: a.label.trim(), tool: a.tool, assetId: a.assetId, frame: a.frame, coords: a.coords, ...ruleOf(a) })),
    findings,
    // A calculator removed from the list is unlinked from its fields.
    reportFields: fields.map((f) => (f.resourceId && !resources.some((r) => r.id === f.resourceId) ? { ...f, resourceId: null } : f)),
    resources,
    working,
  });

  const save = async () => {
    if (annotations.some((a) => !a.label.trim())) return setStatus({ kind: 'error', message: t('labelAll') });
    const parsed = ImagingCaseInputSchema.safeParse(toInput());
    if (!parsed.success) {
      return setStatus({ kind: 'error', message: parsed.error.issues.slice(0, 3).map((i) => i.message).join(' · ') });
    }
    setStatus({ kind: 'saving' });
    try {
      apply(await api('PUT', `instructor/lessons/${lessonId}/imaging`, parsed.data));
      setStatus({ kind: 'saved' });
      toast.success(tCommon('toast.saved'));
    } catch (error) {
      setStatus({ kind: 'error', message: error instanceof ApiClientError && error.messageText ? error.messageText : t('saveFailed') });
    }
  };

  const downloadReference = async () => {
    if (!referenceSr) return;
    const res = await bffFetch(`/api/proxy/media/${referenceSr}/url`);
    if (!res.ok) return setStatus({ kind: 'error', message: t('downloadFailed') });
    const file = await fetch(SignedMediaUrlSchema.parse(await res.json()).url);
    const url = URL.createObjectURL(await file.blob());
    const a = document.createElement('a');
    a.href = url;
    a.download = `${lessonTitle} - reference.dcm`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const updateFinding = (index: number, patch: Partial<FindingKey>) => setFindings((current) => current.map((f, i) => (i === index ? { ...f, ...patch } : f)));
  const updateField = (index: number, patch: Partial<ReportFieldKey>) => setFields((current) => current.map((f, i) => (i === index ? { ...f, ...patch } : f)));

  const disabled = locked || status?.kind === 'saving';

  const scoring = (a: DrawnAnnotation) => {
    const rule = ruleOf(a);
    const image = images.find((i) => i.assetId === a.assetId);
    const reference = valueOf(a, image);
    const field = (label: string, value: number | null, onChange: (v: number | null) => void, extra: { step?: string; placeholder?: string } = {}) => (
      <label className="flex flex-col gap-1">
        {label}
        <Input type="number" min={0} step={extra.step ?? 'any'} placeholder={extra.placeholder} disabled={disabled} value={value ?? ''} onChange={(e) => onChange(num(e.target.value))} />
      </label>
    );
    const tolerance = Math.max(rule.valueToleranceMm ?? 0, ((rule.valueTolerancePercent ?? 0) / 100) * (reference ?? 0));
    return (
      <div className="grid grid-cols-2 gap-2 text-xs">
        {isMeasuringTool(a.tool) ? (
          <>
            {field(t('tolMm'), rule.valueToleranceMm, (v) => setRule(a, { valueToleranceMm: v }))}
            {field(t('tolPercent'), rule.valueTolerancePercent, (v) => setRule(a, { valueTolerancePercent: v }))}
            {field(t('tolPosition'), rule.positionToleranceMm, (v) => setRule(a, { positionToleranceMm: v }), { placeholder: t('optional') })}
          </>
        ) : a.tool === 'POINT' ? (
          <>
            {field(t('radiusPercent'), rule.radiusPercent, (v) => setRule(a, { radiusPercent: v }))}
            {image?.calibration ? field(t('radiusMm'), rule.positionToleranceMm, (v) => setRule(a, { positionToleranceMm: v }), { placeholder: t('optional') }) : null}
          </>
        ) : (
          <>
            {field(t('iouFull'), rule.iouFull === null ? null : Math.round(rule.iouFull * 100), (v) => setRule(a, { iouFull: v === null ? null : v / 100 }), { step: '1' })}
            {field(t('iouHalf'), rule.iouHalf === null ? null : Math.round(rule.iouHalf * 100), (v) => setRule(a, { iouHalf: v === null ? null : v / 100 }), { step: '1', placeholder: t('optional') })}
          </>
        )}
        <label className="flex flex-col gap-1">
          {t('marks')}
          <Input type="number" min={1} max={100} disabled={disabled} value={rule.marks} onChange={(e) => setRule(a, { marks: clampMarks(e.target.value) })} />
        </label>
        {reference !== null && (rule.valueToleranceMm !== null || rule.valueTolerancePercent !== null) ? (
          <p className="col-span-2 text-muted-foreground">
            {t('acceptRange', { min: Math.max(0, reference - tolerance).toFixed(1), max: (reference + tolerance).toFixed(1) })}
          </p>
        ) : null}
        {isRegionTool(a.tool) ? <p className="col-span-2 text-muted-foreground">{t('iouHint')}</p> : null}
        <label className="col-span-2 flex flex-col gap-1">
          {t('teachingPoint')}
          <Textarea rows={2} maxLength={1000} disabled={disabled} value={rule.teachingPoint ?? ''} placeholder={t('teachingPointHint')} onChange={(e) => setRule(a, { teachingPoint: e.target.value || null })} />
        </label>
      </div>
    );
  };

  const newFinding = (): FindingKey => ({
    id: newId('f'),
    label: '',
    multiple: false,
    maxWrong: 0,
    options: [
      { id: newId('o'), label: '', assetId: null, credit: 0 },
      { id: newId('o'), label: '', assetId: null, credit: 0 },
    ],
    correctOptionIds: [],
    marks: 1,
    teachingPoint: null,
  });

  const { confirmDelete, dialog: deleteDialog } = useConfirmDelete();
  return (
    <>
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[94vh] max-w-6xl overflow-y-auto" closeLabel={tCommon('close')} aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>{t('editorTitle', { title: lessonTitle })}</DialogTitle>
        </DialogHeader>
        {!loaded ? (
          <p role="status" className="text-sm text-muted-foreground">{t('loadingImage')}</p>
        ) : (
          <div className="flex flex-col gap-6">
            {locked ? <p className="rounded-lg bg-accent-light p-3 text-sm text-accent-deep">{t('locked')}</p> : null}

            <details className="rounded-lg border border-border p-3">
              <summary className="cursor-pointer font-semibold">{t('stepDictionary', { count: dictionary.length })}</summary>
              <div className="mt-3">
                <DictionaryEditor courseId={courseId} locked={locked} onSaved={setDictionary} />
              </div>
            </details>

            <section className="flex flex-col gap-3">
              <h3 className="font-semibold">{t('stepImages')}</h3>
              <ul className="flex flex-col gap-2">
                {images.map((image, index) => (
                  <li key={image.assetId} className="flex flex-wrap items-center gap-3 rounded-lg border border-border p-3 text-sm">
                    <span className="font-medium">{index + 1}.</span>
                    <Input
                      aria-label={t('imageLabel')}
                      value={image.label}
                      maxLength={100}
                      disabled={disabled}
                      onChange={(e) => setImages((current) => current.map((i) => (i.assetId === image.assetId ? { ...i, label: e.target.value } : i)))}
                      className="w-56"
                    />
                    <span className="text-xs text-muted-foreground">
                      {image.modality ?? 'DICOM'} · {image.columns}×{image.rows}
                      {image.frames > 1 ? ` · ${t('framesCount', { count: image.frames })}` : ''}
                    </span>
                    {!image.calibration ? (
                      <>
                        <span className="flex items-center gap-1 text-xs text-amber-700">
                          <AlertTriangle aria-hidden className="size-3.5" />
                          {t('uncalibratedShort')}
                        </span>
                        <ScaleControl
                          image={image}
                          disabled={disabled}
                          onCalibrated={(meta) => setImages((current) => current.map((i) => (i.assetId === meta.assetId ? meta : i)))}
                        />
                      </>
                    ) : (
                      <span className="text-xs text-muted-foreground">{t('calibrated', { mm: image.calibration.mmPerPxX.toFixed(3) })}</span>
                    )}
                    {image.burnedInAnnotation ? (
                      <span className="flex items-center gap-1 text-xs text-amber-700">
                        <AlertTriangle aria-hidden className="size-3.5" />
                        {t('burnedIn')}
                      </span>
                    ) : null}
                    <button
                      type="button"
                      disabled={disabled}
                      aria-label={t('removeImage')}
                      onClick={() =>
                        confirmDelete(() => {
                          setImages((current) => current.filter((i) => i.assetId !== image.assetId));
                          setAnnotations((current) => current.filter((a) => a.assetId !== image.assetId));
                        })
                      }
                      className="ms-auto rounded p-1 text-muted-foreground hover:bg-muted hover:text-destructive"
                    >
                      <Trash2 aria-hidden className="size-4" />
                    </button>
                  </li>
                ))}
              </ul>
              {images.length < 20 ? (
                <FileUpload
                  kind="DICOM"
                  label={t('addImage')}
                  hint={t('addImageHint')}
                  disabled={disabled}
                  onUploaded={(file) => {
                    if (!file.dicom) return;
                    const meta = file.dicom;
                    setImages((current) => [...current, { ...meta, assetId: file.assetId, label: file.fileName.replace(/\.(dcm|dicom)$/i, '').slice(0, 100) || t('image') }]);
                  }}
                />
              ) : null}
            </section>

            {images.length ? (
              <section className="flex flex-col gap-3">
                <h3 className="font-semibold">{t('stepMeasure')}</h3>
                <p className="text-sm text-muted-foreground">{t('stepMeasureHint')}</p>
                <ImagingWorkspace images={images} annotations={annotations} onChange={setAnnotations} editable={!disabled} dictionary={dictionary} renderExtras={scoring} />
              </section>
            ) : null}

            <section className="flex flex-col gap-3">
              <div className="flex items-center justify-between gap-3">
                <h3 className="font-semibold">{t('stepFindings')}</h3>
                <Button variant="outline" size="sm" disabled={disabled} onClick={() => setFindings((current) => [...current, newFinding()])}>
                  <Plus aria-hidden className="size-4" />
                  {t('addFinding')}
                </Button>
              </div>
              {findings.map((finding, index) => (
                <fieldset key={finding.id} className="flex flex-col gap-2 rounded-lg border border-border p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Input aria-label={t('findingQuestion')} placeholder={t('findingQuestion')} value={finding.label} maxLength={300} disabled={disabled} className="min-w-64 flex-1" onChange={(e) => updateFinding(index, { label: e.target.value })} />
                    <label className="flex items-center gap-1.5 text-xs">
                      <input
                        type="checkbox"
                        disabled={disabled}
                        checked={finding.multiple}
                        onChange={(e) => updateFinding(index, { multiple: e.target.checked, correctOptionIds: e.target.checked ? finding.correctOptionIds : finding.correctOptionIds.slice(0, 1) })}
                      />
                      {t('multipleAnswers')}
                    </label>
                    {finding.multiple ? (
                      <label className="flex items-center gap-1.5 text-xs">
                        {t('maxWrong')}
                        <Input type="number" min={0} max={20} className="h-8 w-16" disabled={disabled} value={finding.maxWrong} onChange={(e) => updateFinding(index, { maxWrong: Math.max(0, Math.min(20, Number(e.target.value) || 0)) })} />
                      </label>
                    ) : null}
                    <label className="flex items-center gap-1.5 text-xs">
                      {t('marks')}
                      <Input aria-label={t('marks')} type="number" min={1} max={100} className="h-8 w-16" disabled={disabled} value={finding.marks} onChange={(e) => updateFinding(index, { marks: clampMarks(e.target.value) })} />
                    </label>
                    <button type="button" aria-label={t('remove')} disabled={disabled} onClick={() => confirmDelete(() => setFindings((current) => current.filter((_, i) => i !== index)))} className="rounded p-1 text-muted-foreground hover:text-destructive">
                      <Trash2 aria-hidden className="size-4" />
                    </button>
                  </div>
                  {finding.options.map((option, optionIndex) => {
                    const correct = finding.correctOptionIds.includes(option.id);
                    const updateOption = (patch: Partial<FindingKey['options'][number]>) =>
                      updateFinding(index, { options: finding.options.map((o) => (o.id === option.id ? { ...o, ...patch } : o)) });
                    return (
                      <div key={option.id} className="flex flex-wrap items-center gap-2 ps-2">
                        <input
                          type={finding.multiple ? 'checkbox' : 'radio'}
                          name={`correct-${finding.id}`}
                          aria-label={t('correctOption')}
                          checked={correct}
                          disabled={disabled}
                          onChange={(e) =>
                            updateFinding(index, {
                              correctOptionIds: finding.multiple
                                ? e.target.checked
                                  ? [...finding.correctOptionIds, option.id]
                                  : finding.correctOptionIds.filter((id) => id !== option.id)
                                : [option.id],
                            })
                          }
                          className="size-4 accent-[var(--primary)]"
                        />
                        <Input
                          aria-label={t('option', { n: optionIndex + 1 })}
                          placeholder={t('option', { n: optionIndex + 1 })}
                          value={option.label}
                          maxLength={200}
                          disabled={disabled}
                          className="min-w-48 flex-1"
                          onChange={(e) => updateOption({ label: e.target.value })}
                        />
                        {images.length > 1 ? (
                          <select
                            aria-label={t('optionImage')}
                            value={option.assetId ?? ''}
                            disabled={disabled}
                            onChange={(e) => updateOption({ assetId: e.target.value || null })}
                            className="h-9 surface-sm px-2 text-xs"
                          >
                            <option value="">{t('noImage')}</option>
                            {images.map((image, i) => (
                              <option key={image.assetId} value={image.assetId}>
                                {i + 1}. {image.label}
                              </option>
                            ))}
                          </select>
                        ) : null}
                        {!finding.multiple && !correct ? (
                          <label className="flex items-center gap-1 text-xs" title={t('partialCreditHint')}>
                            {t('partialCredit')}
                            <Input type="number" min={0} max={100} className="h-8 w-16" disabled={disabled} value={option.credit} onChange={(e) => updateOption({ credit: Math.max(0, Math.min(100, Number(e.target.value) || 0)) })} />
                          </label>
                        ) : null}
                        {finding.options.length > 2 ? (
                          <button
                            type="button"
                            aria-label={t('remove')}
                            disabled={disabled}
                            onClick={() =>
                              confirmDelete(() =>
                                updateFinding(index, {
                                  options: finding.options.filter((o) => o.id !== option.id),
                                  correctOptionIds: finding.correctOptionIds.filter((id) => id !== option.id),
                                }),
                              )
                            }
                            className="rounded p-1 text-muted-foreground hover:text-destructive"
                          >
                            <Trash2 aria-hidden className="size-4" />
                          </button>
                        ) : null}
                      </div>
                    );
                  })}
                  {finding.options.length < 20 ? (
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() => updateFinding(index, { options: [...finding.options, { id: newId('o'), label: '', assetId: null, credit: 0 }] })}
                      className="self-start ps-2 text-sm text-primary hover:underline"
                    >
                      + {t('addOption')}
                    </button>
                  ) : null}
                  <Textarea
                    rows={2}
                    maxLength={1000}
                    disabled={disabled}
                    aria-label={t('teachingPoint')}
                    placeholder={t('teachingPointHint')}
                    value={finding.teachingPoint ?? ''}
                    onChange={(e) => updateFinding(index, { teachingPoint: e.target.value || null })}
                  />
                </fieldset>
              ))}
            </section>

            <section className="flex flex-col gap-3">
              <div className="flex items-center justify-between gap-3">
                <h3 className="font-semibold">{t('stepReport')}</h3>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={disabled}
                  onClick={() => setFields((current) => [...current, { id: newId('r'), label: '', unit: 'mm', value: 0, tolerance: 0, marks: 1, teachingPoint: null, resourceId: null }])}
                >
                  <Plus aria-hidden className="size-4" />
                  {t('addField')}
                </Button>
              </div>
              {fields.length ? (
                <div className="grid grid-cols-[minmax(0,2fr)_80px_100px_100px_64px_minmax(0,1fr)_32px] items-end gap-2 text-xs">
                  <span>{t('fieldLabel')}</span>
                  <span>{t('unit')}</span>
                  <span>{t('referenceValue')}</span>
                  <span>{t('tolerance')}</span>
                  <span>{t('marks')}</span>
                  <span>{t('calculator')}</span>
                  <span />
                  {fields.map((field, index) => (
                    <div key={field.id} className="contents">
                      <Input aria-label={t('fieldLabel')} value={field.label} maxLength={200} disabled={disabled} onChange={(e) => updateField(index, { label: e.target.value })} />
                      <select aria-label={t('unit')} value={field.unit} disabled={disabled} onChange={(e) => updateField(index, { unit: e.target.value as ReportFieldKey['unit'] })} className="h-9 surface-sm px-2 text-sm">
                        {REPORT_UNITS.map((unit) => (
                          <option key={unit} value={unit}>
                            {unit === 'none' ? '—' : unit}
                          </option>
                        ))}
                      </select>
                      <Input aria-label={t('referenceValue')} type="number" step="any" disabled={disabled} value={field.value} onChange={(e) => updateField(index, { value: Number(e.target.value) })} />
                      <Input aria-label={t('tolerance')} type="number" min={0} step="any" disabled={disabled} value={field.tolerance} onChange={(e) => updateField(index, { tolerance: Math.max(0, Number(e.target.value)) })} />
                      <Input aria-label={t('marks')} type="number" min={1} max={100} disabled={disabled} value={field.marks} onChange={(e) => updateField(index, { marks: clampMarks(e.target.value) })} />
                      <select aria-label={t('calculator')} value={field.resourceId ?? ''} disabled={disabled || !resources.length} onChange={(e) => updateField(index, { resourceId: e.target.value || null })} className="h-9 min-w-0 surface-sm px-2 text-sm">
                        <option value="">{resources.length ? t('noCalculator') : t('addCalculatorFirst')}</option>
                        {resources.map((r) => (
                          <option key={r.id} value={r.id}>{r.title || r.url}</option>
                        ))}
                      </select>
                      <button type="button" aria-label={t('remove')} disabled={disabled} onClick={() => confirmDelete(() => setFields((current) => current.filter((_, i) => i !== index)))} className="rounded p-1 text-muted-foreground hover:text-destructive">
                        <Trash2 aria-hidden className="size-4" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : null}
              {fields.length ? <p className="text-xs text-muted-foreground">{t('toleranceHelp')}</p> : null}
            </section>

            <section className="flex flex-col gap-3">
              <div>
                <h3 className="font-semibold">{t('stepResources')}</h3>
                <p className="text-sm text-muted-foreground">{t('resourcesHelp')}</p>
              </div>
              <ResourceLinksEditor value={resources} onChange={setResources} disabled={disabled} />
            </section>

            <section className="flex flex-col gap-3">
              <div>
                <h3 className="font-semibold">{t('stepWorking')}</h3>
                <p className="text-sm text-muted-foreground">{t('workingHelp')}</p>
              </div>
              <div className="flex flex-wrap gap-4" role="radiogroup" aria-label={t('stepWorking')}>
                {WORKING_MODES.map((mode) => (
                  <label key={mode} className="flex items-center gap-2 text-sm">
                    <input type="radio" name="working-mode" className="size-4 accent-[var(--primary)]" disabled={disabled} checked={working.mode === mode} onChange={() => setWorking({ ...working, mode })} />
                    {t(`workingMode.${mode}`)}
                  </label>
                ))}
              </div>
              {working.mode !== 'OFF' ? (
                <Textarea
                  rows={2}
                  maxLength={1000}
                  disabled={disabled}
                  aria-label={t('workingPrompt')}
                  placeholder={t('workingPromptPlaceholder')}
                  value={working.prompt ?? ''}
                  onChange={(e) => setWorking({ ...working, prompt: e.target.value || null })}
                />
              ) : null}
            </section>

            <section className="flex flex-col gap-2">
              <Label htmlFor="imaging-instructions">{t('instructions')}</Label>
              <Textarea id="imaging-instructions" rows={3} maxLength={10_000} disabled={disabled} value={instructions} onChange={(e) => setInstructions(e.target.value)} />
            </section>

            <div className="sticky bottom-0 flex flex-wrap items-center gap-3 border-t border-border bg-background pt-3">
              <Button onClick={() => void save()} disabled={disabled}>
                {status?.kind === 'saving' ? t('saving') : t('save')}
              </Button>
              {referenceSr ? (
                <Button variant="outline" onClick={() => void downloadReference()}>
                  <Download aria-hidden className="size-4" />
                  {t('downloadReference')}
                </Button>
              ) : null}
              {status?.kind === 'saved' ? <span role="status" className="text-sm text-success">{t('saved')}</span> : null}
              {status?.kind === 'error' ? <span role="alert" className="text-sm text-destructive">{status.message}</span> : null}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
      {deleteDialog}
    </>
  );
}
