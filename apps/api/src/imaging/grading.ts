import { measureMm, placementErrorMm, pointDistance, polygonIoU, regionPolygon, type ParsedAnnotation, type ParsedReport } from '@obgyn/dicom';
import {
  conceptByKey,
  findTerm,
  isMeasuringTool,
  labelCode,
  type AnnotationKey,
  type AnnotationTerm,
  type AnnotationTool,
  type Calibration,
  type FindingKey,
  type ImagingResultItem,
  type ReportFieldKey,
  DEFAULT_WORKING,
  WorkingSettingsSchema,
  type WorkingSettings,
} from '@obgyn/types';

export type KeyAnnotation = AnnotationKey & { referenceMm: number | null };

export interface CaseKey {
  annotations: KeyAnnotation[];
  findings: FindingKey[];
  reportFields: ReportFieldKey[];
  /** Whether learners attach their working; older keys default to optional. */
  working: WorkingSettings;
}

export interface GradingImage {
  sopInstanceUID: string;
  calibration: Calibration | null;
  /** Image width in pixels (pin radius as % of width). */
  columns: number;
}

/**
 * Reads a stored key, upgrading the first format (measurements with a fixed
 * `concept`, single-answer findings with `correctOptionId`).
 */
export function readKey(json: unknown): CaseKey {
  type Loose<T> = { [K in keyof T]?: T[K] | null };
  const raw = (json ?? {}) as Record<string, unknown[] | undefined>;
  const stored = (raw.annotations ?? raw.measurements ?? []) as (Loose<KeyAnnotation> & { concept?: string })[];
  const annotations = stored.map((a): KeyAnnotation => {
    const label = a.label ?? a.concept ?? '';
    const coords = a.coords ?? [];
    return {
      ...(a as KeyAnnotation),
      label,
      tool: a.tool ?? conceptByKey(label)?.tool ?? (coords.length === 4 ? 'ELLIPSE' : 'LENGTH'),
      coords,
      frame: a.frame ?? 1,
      valueToleranceMm: a.valueToleranceMm ?? null,
      valueTolerancePercent: a.valueTolerancePercent ?? null,
      positionToleranceMm: a.positionToleranceMm ?? null,
      radiusPercent: a.radiusPercent ?? null,
      iouFull: a.iouFull ?? null,
      iouHalf: a.iouHalf ?? null,
      teachingPoint: a.teachingPoint ?? null,
      referenceMm: a.referenceMm ?? null,
    };
  });
  const findings = ((raw.findings ?? []) as (Loose<FindingKey> & { correctOptionId?: string })[]).map(
    (f): FindingKey => ({
      ...(f as FindingKey),
      multiple: f.multiple ?? false,
      maxWrong: f.maxWrong ?? 0,
      teachingPoint: f.teachingPoint ?? null,
      correctOptionIds: f.correctOptionIds ?? (f.correctOptionId ? [f.correctOptionId] : []),
      options: (f.options ?? []).map((o) => ({ ...o, assetId: o.assetId ?? null, credit: o.credit ?? 0 })),
    }),
  );
  const reportFields = ((raw.reportFields ?? []) as Loose<ReportFieldKey>[]).map(
    (f): ReportFieldKey => ({ ...(f as ReportFieldKey), teachingPoint: f.teachingPoint ?? null, resourceId: f.resourceId ?? null }),
  );
  const working = WorkingSettingsSchema.safeParse(raw.working);
  return { annotations, findings, reportFields, working: working.success ? working.data : DEFAULT_WORKING };
}

/** A reported value may differ from its own drawing by rounding only. */
const MISMATCH_MM = 0.5;
const MISMATCH_RATIO = 0.01;

const mm = (value: number) => `${value.toFixed(1)} mm`;
const pct = (value: number) => `${Math.round(value * 100)}%`;

export function toleranceMm(item: Pick<AnnotationKey, 'valueToleranceMm' | 'valueTolerancePercent'>, referenceMm: number): number {
  return Math.max(item.valueToleranceMm ?? 0, ((item.valueTolerancePercent ?? 0) / 100) * referenceMm);
}

function expectedFor(item: KeyAnnotation): string {
  if (isMeasuringTool(item.tool)) {
    const parts = [
      item.valueToleranceMm !== null ? `${item.valueToleranceMm} mm` : null,
      item.valueTolerancePercent !== null ? `${item.valueTolerancePercent}%` : null,
    ].filter(Boolean);
    return `${mm(item.referenceMm ?? 0)} ± ${parts.join(' or ')}`;
  }
  if (item.tool === 'POINT') {
    const parts = [
      item.positionToleranceMm !== null ? `${item.positionToleranceMm} mm` : null,
      item.radiusPercent !== null ? `${item.radiusPercent}% of width` : null,
    ].filter(Boolean);
    return `pin within ${parts.join(' or ')}`;
  }
  return item.iouHalf !== null
    ? `overlap ≥ ${pct(item.iouFull ?? 0)} (half marks ≥ ${pct(item.iouHalf)})`
    : `overlap ≥ ${pct(item.iouFull ?? 0)}`;
}

/** Which learner graphic can answer which key tool (a box or a polygon both answer a region). */
const COMPATIBLE: Record<AnnotationTool, AnnotationTool> = { POINT: 'POINT', BOX: 'POLYGON', POLYGON: 'POLYGON', LENGTH: 'LENGTH', ELLIPSE: 'ELLIPSE' };

interface Scored {
  index: number;
  earned: number;
  reason: ImagingResultItem['reason'];
  actual: string;
  /** Lower is closer; breaks ties between candidates with the same marks. */
  distance: number;
}

function score(item: KeyAnnotation, found: ParsedAnnotation, index: number, image: GradingImage): Scored | null {
  const cal = image.calibration;
  if (isMeasuringTool(item.tool)) {
    if (!cal) return null;
    const valueMm = measureMm(item.tool, found.coords, cal);
    const reference = item.referenceMm ?? 0;
    const mismatch =
      found.value === null ||
      (found.unit !== null && found.unit !== 'mm') ||
      Math.abs(found.value - valueMm) > Math.max(MISMATCH_MM, MISMATCH_RATIO * valueMm);
    const valueOk = Math.abs(valueMm - reference) <= toleranceMm(item, reference) + 1e-9;
    const placementMm = item.positionToleranceMm === null ? null : placementErrorMm(item.tool, found.coords, item.coords, cal);
    const placementOk = placementMm === null || placementMm <= item.positionToleranceMm! + 1e-9;
    const ok = !mismatch && valueOk && placementOk;
    const placed = placementMm === null ? '' : ` · placed ${placementMm.toFixed(1)} mm from reference (allowed ${item.positionToleranceMm} mm)`;
    return {
      index,
      earned: ok ? item.marks : 0,
      reason: ok ? null : mismatch ? 'MISMATCH' : !valueOk ? 'VALUE' : 'POSITION',
      actual: `${mm(valueMm)}${placed}`,
      distance: Math.abs(valueMm - reference),
    };
  }
  if (item.tool === 'POINT') {
    const d = pointDistance(found.coords[0]!, item.coords[0]!, image.columns, cal);
    const okMm = item.positionToleranceMm !== null && d.mm !== null && d.mm <= item.positionToleranceMm + 1e-9;
    const okPercent = item.radiusPercent !== null && d.percent <= item.radiusPercent + 1e-9;
    const ok = okMm || okPercent;
    return {
      index,
      earned: ok ? item.marks : 0,
      reason: ok ? null : 'POSITION',
      actual: d.mm !== null ? `${d.mm.toFixed(1)} mm from the landmark` : `${d.percent.toFixed(1)}% of image width from the landmark`,
      distance: d.percent,
    };
  }
  const iou = polygonIoU(found.coords, regionPolygon(item.tool, item.coords));
  const full = iou + 1e-9 >= (item.iouFull ?? 0.5);
  const half = !full && item.iouHalf !== null && iou + 1e-9 >= item.iouHalf;
  return {
    index,
    earned: full ? item.marks : half ? item.marks / 2 : 0,
    reason: full ? null : half ? 'PARTIAL' : 'OVERLAP',
    actual: `overlap ${pct(iou)}`,
    distance: 1 - iou,
  };
}

/**
 * Grades a learner's SR against the case key. Labels must match the key's
 * dictionary abbreviation (same DICOM code). Values are recomputed from the
 * SR's own drawings and the image calibration, so a typed number that doesn't
 * match the drawing fails (MISMATCH). Each learner annotation answers one key item.
 */
export function gradeImaging(
  key: CaseKey,
  images: Map<string, GradingImage>,
  report: Pick<ParsedReport, 'annotations' | 'findings' | 'reportFields'>,
  passPercent: number,
  dictionary: readonly AnnotationTerm[] = [],
): { items: ImagingResultItem[]; scorePercent: number; passed: boolean } {
  const used = new Set<number>();
  const items: ImagingResultItem[] = [];

  for (const item of key.annotations) {
    const image = images.get(item.assetId);
    const term = findTerm(item.label, dictionary);
    const code = labelCode(item.label, dictionary);
    const builtin = conceptByKey(item.label.toUpperCase());
    const name = term?.name ?? builtin?.label;
    const base = {
      id: item.id,
      kind: 'ANNOTATION' as const,
      label: name ? `${item.label} — ${name}` : item.label,
      marks: item.marks,
      expected: expectedFor(item),
      reference: { assetId: item.assetId, frame: item.frame, label: item.label, tool: item.tool, coords: item.coords },
      teachingPoint: item.teachingPoint ?? null,
    };
    const candidates = image
      ? report.annotations
          .map((found, index) => ({ found, index }))
          .filter(
            ({ found, index }) =>
              !used.has(index) &&
              found.code.value === code.value &&
              found.code.scheme === code.scheme &&
              found.sopInstanceUID === image.sopInstanceUID &&
              found.frame === item.frame &&
              found.tool === COMPATIBLE[item.tool],
          )
          .map(({ found, index }) => score(item, found, index, image))
          .filter((s): s is Scored => s !== null)
      : [];
    if (candidates.length === 0) {
      items.push({ ...base, earned: 0, passed: false, actual: null, reason: 'MISSING' });
      continue;
    }
    const best = [...candidates].sort((a, b) => b.earned - a.earned || a.distance - b.distance)[0]!;
    used.add(best.index);
    items.push({ ...base, earned: best.earned, passed: best.earned === item.marks, actual: best.actual, reason: best.reason });
  }

  for (const finding of key.findings) {
    const chosen = report.findings.get(finding.id) ?? [];
    const labelOf = (id: string) => finding.options.find((o) => o.id === id)?.label ?? id;
    const base = {
      id: finding.id,
      kind: 'FINDING' as const,
      label: finding.label,
      marks: finding.marks,
      expected: finding.correctOptionIds.map(labelOf).join(', ') + (finding.multiple && finding.maxWrong ? ` (≤ ${finding.maxWrong} wrong)` : ''),
      actual: chosen.length ? chosen.map(labelOf).join(', ') : null,
      reference: null,
      teachingPoint: finding.teachingPoint ?? null,
    };
    if (chosen.length === 0) {
      items.push({ ...base, earned: 0, passed: false, reason: 'MISSING' });
      continue;
    }
    if (finding.multiple) {
      const correct = new Set(finding.correctOptionIds);
      const missed = finding.correctOptionIds.filter((id) => !chosen.includes(id)).length;
      const wrong = chosen.filter((id) => !correct.has(id)).length;
      const ok = missed === 0 && wrong <= finding.maxWrong;
      items.push({ ...base, earned: ok ? finding.marks : 0, passed: ok, reason: ok ? null : 'WRONG' });
      continue;
    }
    const answer = chosen[0]!;
    if (answer === finding.correctOptionIds[0]) {
      items.push({ ...base, earned: finding.marks, passed: true, reason: null });
      continue;
    }
    const credit = finding.options.find((o) => o.id === answer)?.credit ?? 0;
    items.push({ ...base, earned: (finding.marks * credit) / 100, passed: false, reason: credit > 0 ? 'PARTIAL' : 'WRONG' });
  }

  for (const field of key.reportFields) {
    const value = report.reportFields.get(field.id);
    const unit = field.unit === 'none' ? '' : ` ${field.unit}`;
    const ok = value !== undefined && Math.abs(value - field.value) <= field.tolerance + 1e-9;
    items.push({
      id: field.id,
      kind: 'REPORT_FIELD',
      label: field.label,
      marks: field.marks,
      earned: ok ? field.marks : 0,
      passed: ok,
      expected: `${field.value}${unit} ± ${field.tolerance}`,
      actual: value === undefined ? null : `${value}${unit}`,
      reason: ok ? null : value === undefined ? 'MISSING' : 'VALUE',
      reference: null,
      teachingPoint: field.teachingPoint ?? null,
    });
  }

  const total = items.reduce((sum, item) => sum + item.marks, 0);
  const earned = items.reduce((sum, item) => sum + item.earned, 0);
  const scorePercent = total === 0 ? 0 : Math.round((earned / total) * 100);
  return { items, scorePercent, passed: scorePercent >= passPercent };
}
