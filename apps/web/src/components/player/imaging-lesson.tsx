'use client';

import {
  dicomPseudonym,
  ImagingResultSchema,
  MAX_WORKING_FILES,
  labelCode,
  normalizeLabel,
  SignedMediaUrlSchema,
  type AnnotationTool,
  type ImagingCasePublic,
  type ImagingResult,
} from '@obgyn/types';
import { Button } from '@obgyn/ui';
import { Calculator, CheckCircle2, Circle, Download, Eye, EyeOff, Lightbulb, MinusCircle, X, XCircle } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { ImagingWorkspace, termName, valueOf, type DrawnAnnotation } from '@/components/imaging/imaging-workspace';
import { WorkingView } from '@/components/imaging/working-view';
import { bffFetch } from '@/lib/client-fetch';
import { FileUpload } from '../instructor/editor/file-upload';
import { useResourcePanel } from './resources';
import { api, ApiClientError } from '@/lib/instructor-api';

function toBase64(bytes: ArrayBuffer): string {
  const view = new Uint8Array(bytes);
  let binary = '';
  for (let i = 0; i < view.length; i += 0x8000) binary += String.fromCharCode(...view.subarray(i, i + 0x8000));
  return btoa(binary);
}

function saveFile(bytes: ArrayBuffer | Blob, name: string) {
  const url = URL.createObjectURL(bytes instanceof Blob ? bytes : new Blob([bytes], { type: 'application/dicom' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** A box or an outline both answer a region task. */
const answers = (task: AnnotationTool, drawn: AnnotationTool) =>
  task === drawn || ((task === 'BOX' || task === 'POLYGON') && (drawn === 'BOX' || drawn === 'POLYGON'));

const formatMarks = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

/**
 * IMAGING lesson: the learner annotates the case images with the same tools
 * faculty used, labelling each drawing with the course's shorthand dictionary,
 * answers the findings, and submits. Their DICOM SR is built here in the
 * browser and graded by the API against the faculty answer key.
 */
export function ImagingLesson({
  lessonId,
  title,
  imaging,
  enrolled,
}: {
  lessonId: string;
  title: string;
  imaging: ImagingCasePublic;
  enrolled: boolean;
}) {
  const t = useTranslations('Imaging');
  const tWorking = useTranslations('Working');
  const router = useRouter();
  const [annotations, setAnnotations] = useState<DrawnAnnotation[]>([]);
  const [findings, setFindings] = useState<Record<string, string[]>>({});
  const [fields, setFields] = useState<Record<string, string>>({});
  const [explanation, setExplanation] = useState('');
  const [workingFiles, setWorkingFiles] = useState<{ id: string; name: string }[]>([]);
  /** Remounts the uploader after each file so several can be added. */
  const [uploadKey, setUploadKey] = useState(0);
  const { resources, open: openResource } = useResourcePanel();
  const workingMode = imaging.working.mode;
  const [result, setResult] = useState<ImagingResult | null>(imaging.lastResult);
  const [showReference, setShowReference] = useState(false);
  const [lastSr, setLastSr] = useState<ArrayBuffer | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const resultRef = useRef<HTMLElement>(null);
  /** Shown next to the button: results render at the top, out of view. */
  const [justGraded, setJustGraded] = useState<ImagingResult | null>(null);

  const dictionary = imaging.dictionary;
  const imageLabel = (assetId: string) => imaging.images.find((i) => i.assetId === assetId)?.label ?? '';
  const taskDone = (task: ImagingCasePublic['tasks'][number]) =>
    annotations.some((a) => a.assetId === task.assetId && answers(task.tool, a.tool) && normalizeLabel(a.label) === normalizeLabel(task.label));

  /** If exactly one open task on this image uses this tool, pre-fill its label. */
  const suggestLabel = (tool: AnnotationTool, assetId: string) => {
    const open = imaging.tasks.filter((task) => task.assetId === assetId && answers(task.tool, tool) && !taskDone(task));
    return open.length === 1 ? open[0]!.label : '';
  };

  // dcmjs (~690 kB) is only needed to write the report, so it loads when the learner submits.
  const buildReport = async (): Promise<ArrayBuffer> => {
    const { buildMeasurementReport } = await import('@obgyn/dicom/sr');
    const byAsset = new Map(imaging.images.map((image) => [image.assetId, image]));
    return buildMeasurementReport({
      images: imaging.images,
      patient: dicomPseudonym(imaging.images[0]!.assetId),
      observer: 'Learner',
      title,
      annotations: annotations.map((a) => ({
        trackingId: a.id.slice(0, 64),
        code: labelCode(a.label, dictionary),
        tool: a.tool,
        valueMm: valueOf(a, byAsset.get(a.assetId)),
        coords: a.coords,
        image: byAsset.get(a.assetId)!,
        frame: a.frame,
      })),
      findings: imaging.findings.flatMap((f) =>
        (findings[f.id] ?? []).map((optionId) => ({ id: f.id, label: f.label, optionId, optionLabel: f.options.find((o) => o.id === optionId)!.label })),
      ),
      reportFields: imaging.reportFields
        .filter((f) => fields[f.id]?.trim() && Number.isFinite(Number(fields[f.id])))
        .map((f) => ({ id: f.id, label: f.label, unit: f.unit, value: Number(fields[f.id]) })),
    });
  };

  const submit = async () => {
    setError(null);
    setJustGraded(null);
    if (annotations.some((a) => !a.label.trim())) return setError(t('labelAll'));
    if (workingMode === 'REQUIRED' && !explanation.trim() && !workingFiles.length) return setError(tWorking('required'));
    const missing = imaging.tasks.filter((task) => !taskDone(task)).length;
    const unanswered =
      imaging.findings.filter((f) => !findings[f.id]?.length).length + imaging.reportFields.filter((f) => !fields[f.id]?.trim()).length;
    if ((missing || unanswered) && !window.confirm(t('confirmIncomplete', { missing, unanswered }))) return;
    setPending(true);
    try {
      const sr = await buildReport();
      setLastSr(sr);
      const graded = ImagingResultSchema.parse(await api('POST', `learn/lessons/${lessonId}/imaging/attempts`, {
          sr: toBase64(sr),
          ...(workingMode === 'OFF' ? {} : { explanation: explanation.trim() || null, workingAssetIds: workingFiles.map((f) => f.id) }),
        }));
      setResult(graded);
      setJustGraded(graded);
      setShowReference(false);
      // Results render at the top of the lesson; bring them into view.
      requestAnimationFrame(() => resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
      router.refresh();
    } catch (e) {
      setError(e instanceof ApiClientError && e.messageText ? e.messageText : t('submitFailed'));
    } finally {
      setPending(false);
    }
  };

  const downloadSubmitted = async () => {
    if (!result) return;
    if (lastSr) return saveFile(lastSr, `${title} - my report.dcm`);
    const res = await bffFetch(`/api/proxy/media/${result.srAssetId}/url`);
    if (!res.ok) return setError(t('downloadFailed'));
    const signed = SignedMediaUrlSchema.parse(await res.json());
    const file = await fetch(signed.url);
    if (!file.ok) return setError(t('downloadFailed'));
    saveFile(await file.blob(), `${title} - my report.dcm`);
  };

  const references = showReference && result ? result.items.flatMap((item) => (item.reference ? [item.reference] : [])) : [];

  const toggleOption = (findingId: string, optionId: string, multiple: boolean) =>
    setFindings((current) => {
      const chosen = current[findingId] ?? [];
      const next = multiple ? (chosen.includes(optionId) ? chosen.filter((id) => id !== optionId) : [...chosen, optionId]) : [optionId];
      return { ...current, [findingId]: next };
    });

  return (
    <div className="flex flex-col gap-6">
      {imaging.instructions ? <p className="whitespace-pre-line text-sm leading-relaxed">{imaging.instructions}</p> : null}

      {result ? (
        <section ref={resultRef} aria-labelledby="imaging-result" className="flex scroll-mt-4 flex-col gap-3">
          <div
            role="status"
            className={`flex flex-wrap items-center justify-between gap-3 rounded-xl p-4 ${
              result.passed
                ? 'bg-green-50 text-green-900 dark:bg-green-900/30 dark:text-green-100'
                : 'bg-amber-50 text-amber-900 dark:bg-amber-900/30 dark:text-amber-100'
            }`}
          >
            <p id="imaging-result" className="flex items-center gap-2 text-lg font-semibold">
              {result.passed ? <CheckCircle2 aria-hidden className="size-6" /> : <XCircle aria-hidden className="size-6" />}
              {result.passed ? t('passed', { score: result.scorePercent }) : t('failed', { score: result.scorePercent, pass: result.passPercent })}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowReference((v) => !v)}>
                {showReference ? <EyeOff aria-hidden className="size-4" /> : <Eye aria-hidden className="size-4" />}
                {showReference ? t('hideReference') : t('showReference')}
              </Button>
              <Button variant="outline" size="sm" onClick={() => void downloadSubmitted()}>
                <Download aria-hidden className="size-4" />
                {t('downloadSr')}
              </Button>
            </div>
          </div>
          {showReference ? <p className="text-xs text-muted-foreground">{t('colourKey')}</p> : null}
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">{t('item')}</th>
                  <th className="px-3 py-2">{t('expected')}</th>
                  <th className="px-3 py-2">{t('yours')}</th>
                  <th className="px-3 py-2">{t('marks')}</th>
                </tr>
              </thead>
              <tbody>
                {result.items.map((item) => (
                  <tr key={`${item.kind}-${item.id}`} className="border-t border-border align-top">
                    <td className="px-3 py-2 font-medium">
                      <span className="flex items-center gap-1.5">
                        {item.passed ? (
                          <CheckCircle2 aria-label={t('ok')} className="size-4 shrink-0 text-success" />
                        ) : item.earned > 0 ? (
                          <MinusCircle aria-label={t('partly')} className="size-4 shrink-0 text-amber-600" />
                        ) : (
                          <XCircle aria-label={t('notOk')} className="size-4 shrink-0 text-destructive" />
                        )}
                        {item.label}
                      </span>
                      {item.reason ? <span className="ms-5 block text-xs text-destructive">{t(`reason.${item.reason}`)}</span> : null}
                      {item.teachingPoint ? (
                        <span className="ms-5 mt-1 flex items-start gap-1 text-xs font-normal text-muted-foreground">
                          <Lightbulb aria-hidden className="mt-0.5 size-3.5 shrink-0 text-amber-500" />
                          {item.teachingPoint}
                        </span>
                      ) : null}
                    </td>
                    <td className="px-3 py-2">{item.expected}</td>
                    <td className="px-3 py-2">{item.actual ?? '—'}</td>
                    <td className="px-3 py-2 tabular-nums">
                      {formatMarks(item.earned)}/{item.marks}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {result.working ? <WorkingView working={result.working} /> : null}
        </section>
      ) : null}

      <ImagingWorkspace
        images={imaging.images}
        annotations={annotations}
        onChange={setAnnotations}
        references={references}
        editable={enrolled}
        dictionary={dictionary}
        suggestLabel={suggestLabel}
        sidebarTop={
          imaging.tasks.length ? (
            <div className="rounded-lg border border-border p-3">
              <h3 className="mb-2 text-sm font-semibold">{t('tasks')}</h3>
              <ul className="flex flex-col gap-1.5 text-sm">
                {imaging.tasks.map((task) => {
                  const name = termName(task.label, dictionary);
                  return (
                    <li key={task.id} className="flex items-start gap-2">
                      {taskDone(task) ? (
                        <CheckCircle2 aria-label={t('done')} className="mt-0.5 size-4 shrink-0 text-success" />
                      ) : (
                        <Circle aria-label={t('todo')} className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                      )}
                      <span>
                        {t(`task.${task.tool}`, { label: task.label, name: name ?? task.label })}
                        {imaging.images.length > 1 ? <span className="text-muted-foreground"> · {imageLabel(task.assetId)}</span> : null}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null
        }
      />

      {imaging.findings.length ? (
        <section className="flex flex-col gap-4">
          <h3 className="font-semibold">{t('findings')}</h3>
          {imaging.findings.map((finding) => (
            <fieldset key={finding.id} className="flex flex-col gap-2 rounded-lg border border-border p-4">
              <legend className="px-1 text-sm font-medium">
                {finding.label}
                {finding.multiple ? <span className="ms-2 text-xs font-normal text-muted-foreground">{t('selectAll')}</span> : null}
              </legend>
              {finding.options.map((option) => (
                <label key={option.id} className="flex items-center gap-2 text-sm">
                  <input
                    type={finding.multiple ? 'checkbox' : 'radio'}
                    name={`finding-${finding.id}`}
                    checked={(findings[finding.id] ?? []).includes(option.id)}
                    disabled={!enrolled}
                    onChange={() => toggleOption(finding.id, option.id, finding.multiple)}
                    className="size-4 accent-[var(--primary)]"
                  />
                  {option.label}
                  {option.assetId ? <span className="text-xs text-muted-foreground">({imageLabel(option.assetId)})</span> : null}
                </label>
              ))}
            </fieldset>
          ))}
        </section>
      ) : null}

      {imaging.reportFields.length ? (
        <section className="flex flex-col gap-3">
          <h3 className="font-semibold">{t('report')}</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            {imaging.reportFields.map((field) => (
              <label key={field.id} className="flex flex-col gap-1 text-sm">
                <span className="font-medium">{field.label}</span>
                <span className="flex items-center gap-2">
                  <input
                    type="number"
                    step="any"
                    inputMode="decimal"
                    value={fields[field.id] ?? ''}
                    disabled={!enrolled}
                    onChange={(e) => setFields((current) => ({ ...current, [field.id]: e.target.value }))}
                    className="w-40 surface-sm px-3 py-2"
                  />
                  {field.unit === 'none' ? null : <span className="text-muted-foreground">{field.unit}</span>}
                  {field.resourceId && resources.some((r) => r.id === field.resourceId) ? (
                    <button
                      type="button"
                      onClick={() => openResource(field.resourceId!)}
                      className="flex items-center gap-1 rounded-full border border-border px-2 py-1.5 text-xs font-medium text-primary hover:border-primary"
                    >
                      <Calculator aria-hidden className="size-3.5" />
                      {t('calculateWith', { title: resources.find((r) => r.id === field.resourceId)!.title })}
                    </button>
                  ) : null}
                </span>
              </label>
            ))}
          </div>
        </section>
      ) : null}

      {workingMode !== 'OFF' && enrolled ? (
        <section aria-labelledby="working-heading" className="flex flex-col gap-3 rounded-xl border border-border p-4">
          <div>
            <h3 id="working-heading" className="font-semibold">
              {tWorking('yourWorking')}{' '}
              <span className="text-sm font-normal text-muted-foreground">({tWorking(workingMode === 'REQUIRED' ? 'requiredTag' : 'optionalTag')})</span>
            </h3>
            <p className="text-sm text-muted-foreground">{imaging.working.prompt ?? tWorking('defaultPrompt')}</p>
          </div>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">{tWorking('explanation')}</span>
            <textarea
              rows={5}
              maxLength={5000}
              value={explanation}
              onChange={(e) => setExplanation(e.target.value)}
              placeholder={tWorking('explanationPlaceholder')}
              className="surface-sm px-3 py-2"
            />
          </label>
          {workingFiles.length ? (
            <ul className="flex flex-wrap gap-2" aria-label={tWorking('attached')}>
              {workingFiles.map((f) => (
                <li key={f.id} className="flex items-center gap-1 rounded-lg border border-border py-1 pe-1 ps-3 text-sm">
                  <span className="max-w-48 truncate">{f.name}</span>
                  <button type="button" aria-label={tWorking('removeFile', { name: f.name })} onClick={() => setWorkingFiles((cur) => cur.filter((x) => x.id !== f.id))} className="rounded p-1 text-muted-foreground hover:text-destructive">
                    <X aria-hidden className="size-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          {workingFiles.length < MAX_WORKING_FILES ? (
            <FileUpload
              key={uploadKey}
              scope="learner"
              kind="IMAGE"
              accept={['image/jpeg', 'image/png', 'image/webp', 'application/pdf']}
              label={tWorking('attach')}
              hint={tWorking('attachHint', { max: MAX_WORKING_FILES })}
              currentName={null}
              onUploaded={({ assetId, fileName }) => {
                setWorkingFiles((cur) => [...cur, { id: assetId, name: fileName }]);
                setUploadKey((k) => k + 1);
              }}
            />
          ) : null}
        </section>
      ) : null}

      {enrolled ? (
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={() => void submit()} disabled={pending}>
            {pending ? t('grading') : result ? t('resubmit') : t('submit')}
          </Button>
          <span className="text-sm text-muted-foreground">{t('passMark', { percent: imaging.passPercent })}</span>
          {justGraded && !pending ? (
            <button
              type="button"
              role="status"
              onClick={() => resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
              className={`text-sm font-medium underline-offset-2 hover:underline ${justGraded.passed ? 'text-success' : 'text-destructive'}`}
            >
              {justGraded.passed ? t('passed', { score: justGraded.scorePercent }) : t('failed', { score: justGraded.scorePercent, pass: justGraded.passPercent })} ·{' '}
              {t('seeResults')}
            </button>
          ) : null}
          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">{t('enrolToSubmit')}</p>
      )}
    </div>
  );
}
