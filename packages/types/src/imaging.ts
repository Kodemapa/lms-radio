import { z } from 'zod';
import { ResourceLinkSchema, ResourceLinksSchema } from './resources.js';

// ---- Measurement concepts ---------------------------------------------------

export type MeasurementTool = 'LENGTH' | 'ELLIPSE';

export interface MeasurementConcept {
  key: string;
  label: string;
  /** LOINC code from DICOM PS3.16 CID 12005/12006/12009/12011. */
  code: { value: string; scheme: 'LN'; meaning: string };
  tool: MeasurementTool;
}

const ln = (value: string, meaning: string) => ({ value, scheme: 'LN' as const, meaning });

/**
 * Fetal and obstetric measurements a case can ask for. Codes are the DICOM
 * standard's (CID 12005 fetal biometry, 12006 long bones, 12009 early
 * gestation, 12011 pelvis/uterus), so reports interoperate with ultrasound
 * machines and PACS. PC-PNDT: no concept identifies fetal sex.
 */
export const MEASUREMENT_CONCEPTS = [
  { key: 'BPD', label: 'Biparietal diameter', code: ln('11820-8', 'Biparietal Diameter'), tool: 'LENGTH' },
  { key: 'OFD', label: 'Occipito-frontal diameter', code: ln('11851-3', 'Occipital-Frontal Diameter'), tool: 'LENGTH' },
  { key: 'HC', label: 'Head circumference', code: ln('11984-2', 'Head Circumference'), tool: 'ELLIPSE' },
  { key: 'AC', label: 'Abdominal circumference', code: ln('11979-2', 'Abdominal Circumference'), tool: 'ELLIPSE' },
  { key: 'APAD', label: 'Antero-posterior abdominal diameter', code: ln('11818-2', 'Anterior-Posterior Abdominal Diameter'), tool: 'LENGTH' },
  { key: 'TAD', label: 'Transverse abdominal diameter', code: ln('11862-0', 'Transverse Abdominal Diameter'), tool: 'LENGTH' },
  { key: 'FL', label: 'Femur length', code: ln('11963-6', 'Femur Length'), tool: 'LENGTH' },
  { key: 'HL', label: 'Humerus length', code: ln('11966-9', 'Humerus length'), tool: 'LENGTH' },
  { key: 'TCD', label: 'Transverse cerebellar diameter', code: ln('11863-8', 'Transverse Cerebellar Diameter'), tool: 'LENGTH' },
  { key: 'CM', label: 'Cisterna magna', code: ln('11860-4', 'Cisterna Magna Length'), tool: 'LENGTH' },
  { key: 'TC', label: 'Thoracic circumference', code: ln('11988-3', 'Thoracic Circumference'), tool: 'ELLIPSE' },
  { key: 'CRL', label: 'Crown-rump length', code: ln('11957-8', 'Crown Rump Length'), tool: 'LENGTH' },
  { key: 'NT', label: 'Nuchal translucency', code: ln('33069-6', 'Nuchal Translucency'), tool: 'LENGTH' },
  { key: 'GSD', label: 'Gestational sac diameter', code: ln('11850-5', 'Gestational Sac Diameter'), tool: 'LENGTH' },
  { key: 'CERVIX', label: 'Cervical length', code: ln('11961-0', 'Cervix Length'), tool: 'LENGTH' },
] as const satisfies readonly MeasurementConcept[];

export type ConceptKey = (typeof MEASUREMENT_CONCEPTS)[number]['key'];
export const CONCEPT_KEYS = MEASUREMENT_CONCEPTS.map((concept) => concept.key) as [ConceptKey, ...ConceptKey[]];
export const ConceptKeySchema = z.enum(CONCEPT_KEYS);

export function conceptByKey(key: string): MeasurementConcept | undefined {
  return MEASUREMENT_CONCEPTS.find((concept) => concept.key === key);
}

export function conceptByCode(value: string, scheme = 'LN'): MeasurementConcept | undefined {
  return MEASUREMENT_CONCEPTS.find((concept) => concept.code.value === value && concept.code.scheme === scheme);
}


// ---- Images -----------------------------------------------------------------

/** Physical size of one pixel, from the DICOM header. Null = uncalibrated (can't measure). */
export const CalibrationSchema = z.object({
  mmPerPxX: z.number().positive(),
  mmPerPxY: z.number().positive(),
  source: z.enum(['US_REGION', 'PIXEL_SPACING']),
});
export type Calibration = z.infer<typeof CalibrationSchema>;

/** What the API records about an uploaded (de-identified) DICOM image. */
export const DicomImageMetaSchema = z.object({
  sopClassUID: z.string(),
  sopInstanceUID: z.string(),
  studyInstanceUID: z.string(),
  seriesInstanceUID: z.string(),
  modality: z.string().nullable(),
  rows: z.number().int().positive(),
  columns: z.number().int().positive(),
  frames: z.number().int().positive(),
  calibration: CalibrationSchema.nullable(),
  /** The header says text is burned into the pixels (may include patient details). */
  burnedInAnnotation: z.boolean(),
});
export type DicomImageMeta = z.infer<typeof DicomImageMetaSchema>;

export const ImagingImageSchema = DicomImageMetaSchema.extend({
  assetId: z.string().uuid(),
  label: z.string(),
});
export type ImagingImage = z.infer<typeof ImagingImageSchema>;

/** Patient name/ID written into de-identified images and the SRs that reference them. */
export function dicomPseudonym(assetId: string): { name: string; id: string } {
  const id = `CASE-${assetId.slice(0, 8).toUpperCase()}`;
  return { name: `Anonymous^${id}`, id };
}

// ---- Annotation tools -------------------------------------------------------

/**
 * POINT: a landmark pin (T2). BOX / POLYGON: a region (T1, T6).
 * LENGTH: caliper. ELLIPSE: circumference (HC/AC). The last two give a value in mm.
 */
export const ANNOTATION_TOOLS = ['POINT', 'BOX', 'POLYGON', 'LENGTH', 'ELLIPSE'] as const;
export const AnnotationToolSchema = z.enum(ANNOTATION_TOOLS);
export type AnnotationTool = z.infer<typeof AnnotationToolSchema>;

/** Coordinates each tool stores: BOX is two opposite corners; POLYGON is its vertices. */
export const TOOL_POINTS: Record<AnnotationTool, { min: number; max: number }> = {
  POINT: { min: 1, max: 1 },
  BOX: { min: 2, max: 2 },
  POLYGON: { min: 3, max: 64 },
  LENGTH: { min: 2, max: 2 },
  ELLIPSE: { min: 4, max: 4 },
};

export const isMeasuringTool = (tool: AnnotationTool): tool is MeasurementTool => tool === 'LENGTH' || tool === 'ELLIPSE';
export const isRegionTool = (tool: AnnotationTool) => tool === 'BOX' || tool === 'POLYGON';

/** Our private coding scheme for case-specific labels, findings and report fields. */
export const LOCAL_CODING_SCHEME = '99OBGLMS';

// ---- Annotation dictionary (course-level shorthand) ---------------------------

/** A shorthand label, e.g. "CSP" or "4CV". Becomes a DICOM code value (≤16 chars). */
export const AbbrSchema = z
  .string()
  .trim()
  .regex(/^[A-Za-z0-9][A-Za-z0-9 ._\-/+]{0,15}$/, 'Use up to 16 letters, digits, spaces or . _ - / +');

export const AnnotationTermSchema = z.object({
  abbr: AbbrSchema,
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(500).nullable().default(null),
  /** LOINC code for standard measurements, e.g. 11984-2 for HC. */
  loinc: z
    .string()
    .trim()
    .regex(/^\d{1,7}-\d$/, 'LOINC codes look like 11984-2')
    .nullable()
    .default(null),
  /** Tools learners should use with this label (a hint, not enforced). */
  tools: z.array(AnnotationToolSchema).max(5).default([]),
});
export type AnnotationTerm = z.infer<typeof AnnotationTermSchema>;

export const AnnotationDictionarySchema = z
  .array(AnnotationTermSchema)
  .max(300)
  .superRefine((terms, ctx) => {
    const seen = new Set<string>();
    terms.forEach((term, index) => {
      const key = normalizeLabel(term.abbr);
      if (seen.has(key)) ctx.addIssue({ code: 'custom', path: [index, 'abbr'], message: `"${term.abbr}" is listed twice` });
      seen.add(key);
    });
  });

/** Labels compare case- and space-insensitively: "csp", "CSP " and "Csp" are the same. */
export function normalizeLabel(label: string): string {
  return label.trim().replace(/\s+/g, ' ').toUpperCase();
}

export function findTerm(label: string, terms: readonly AnnotationTerm[]): AnnotationTerm | undefined {
  const key = normalizeLabel(label);
  return terms.find((term) => normalizeLabel(term.abbr) === key);
}

/**
 * The DICOM code a label is written with: the dictionary term's LOINC code,
 * else the built-in fetal biometry concept, else our local scheme. Learner and
 * key use the same function, so labels match exactly when the abbreviations do.
 */
export function labelCode(label: string, terms: readonly AnnotationTerm[]): { value: string; scheme: string; meaning: string } {
  const key = normalizeLabel(label);
  const term = findTerm(label, terms);
  if (term?.loinc) return { value: term.loinc, scheme: 'LN', meaning: term.name };
  const builtin = conceptByKey(key);
  if (builtin) return { value: builtin.code.value, scheme: 'LN', meaning: term?.name ?? builtin.code.meaning };
  return { value: key.slice(0, 16), scheme: LOCAL_CODING_SCHEME, meaning: term?.name ?? label.trim() };
}

/** The standard fetal biometry measurements, ready to import into a course dictionary. */
export const STANDARD_BIOMETRY_TERMS: AnnotationTerm[] = MEASUREMENT_CONCEPTS.map((concept) => ({
  abbr: concept.key,
  name: concept.label,
  description: null,
  loinc: concept.code.value,
  tools: [concept.tool],
}));

// ---- Answer key (instructor) -----------------------------------------------

/** Short ids: they become DICOM code values (SH, ≤16 characters). */
export const ShortIdSchema = z.string().regex(/^[a-z0-9]{1,12}$/, 'Use 1–12 lowercase letters or digits');

const PointSchema = z.tuple([z.number().finite(), z.number().finite()]);
export type Point = z.infer<typeof PointSchema>;

const text = (max: number) => z.string().trim().min(1).max(max);
const marks = z.number().int().min(1).max(100);
const teachingPoint = z.string().trim().max(1000).nullable().default(null);

export const AnnotationKeySchema = z
  .object({
    id: ShortIdSchema,
    /** Dictionary abbreviation the learner must use, e.g. "CSP". */
    label: AbbrSchema,
    tool: AnnotationToolSchema,
    assetId: z.string().uuid(),
    /** 1-based frame for multi-frame images. */
    frame: z.number().int().min(1).default(1),
    /** Image pixel coordinates (column, row); see TOOL_POINTS. */
    coords: z.array(PointSchema).min(1).max(64),
    /** LENGTH/ELLIPSE: pass when |learner − reference| ≤ this many mm… */
    valueToleranceMm: z.number().min(0).max(1000).nullable().default(null),
    /** …or ≤ this percentage of the reference (either passes). */
    valueTolerancePercent: z.number().min(0).max(100).nullable().default(null),
    /** LENGTH/ELLIPSE: drawing within this many mm of the reference. POINT: pin radius in mm. */
    positionToleranceMm: z.number().min(0).max(1000).nullable().default(null),
    /** POINT: pin radius as % of image width (works on uncalibrated images). */
    radiusPercent: z.number().min(0).max(100).nullable().default(null),
    /** BOX/POLYGON: overlap (IoU) for full marks… */
    iouFull: z.number().min(0).max(1).nullable().default(null),
    /** …and for half marks. */
    iouHalf: z.number().min(0).max(1).nullable().default(null),
    marks,
    teachingPoint,
  })
  .superRefine((value, ctx) => {
    const { min, max } = TOOL_POINTS[value.tool];
    if (value.coords.length < min || value.coords.length > max) {
      ctx.addIssue({ code: 'custom', path: ['coords'], message: `${value.label}: draw it again with the ${value.tool.toLowerCase()} tool` });
    }
    if (isMeasuringTool(value.tool) && value.valueToleranceMm === null && value.valueTolerancePercent === null) {
      ctx.addIssue({ code: 'custom', path: ['valueToleranceMm'], message: `${value.label}: set a value tolerance (mm or %)` });
    }
    if (value.tool === 'POINT' && value.positionToleranceMm === null && value.radiusPercent === null) {
      ctx.addIssue({ code: 'custom', path: ['radiusPercent'], message: `${value.label}: set a pin radius (mm or % of width)` });
    }
    if (isRegionTool(value.tool) && value.iouFull === null) {
      ctx.addIssue({ code: 'custom', path: ['iouFull'], message: `${value.label}: set the overlap needed for full marks` });
    }
    if (value.iouFull !== null && value.iouHalf !== null && value.iouHalf > value.iouFull) {
      ctx.addIssue({ code: 'custom', path: ['iouHalf'], message: `${value.label}: half-mark overlap must be below the full-mark overlap` });
    }
  });
export type AnnotationKey = z.infer<typeof AnnotationKeySchema>;

export const FindingOptionSchema = z.object({
  id: ShortIdSchema,
  label: text(200),
  /** Optional: this option is one of the case images (plane pickers, T4). */
  assetId: z.string().uuid().nullable().default(null),
  /** Single-answer questions: partial credit (%) for a clinically close wrong answer. */
  credit: z.number().int().min(0).max(100).default(0),
});

export const FindingKeySchema = z
  .object({
    id: ShortIdSchema,
    label: text(300),
    /** Learners may pick several options (differentials, "select all required planes"). */
    multiple: z.boolean().default(false),
    options: z.array(FindingOptionSchema).min(2).max(20),
    correctOptionIds: z.array(ShortIdSchema).min(1),
    /** Multiple: full marks if every correct option is picked with at most this many wrong picks. */
    maxWrong: z.number().int().min(0).max(20).default(0),
    marks,
    teachingPoint,
  })
  .superRefine((value, ctx) => {
    const ids = new Set(value.options.map((o) => o.id));
    if (!value.correctOptionIds.every((id) => ids.has(id))) {
      ctx.addIssue({ code: 'custom', path: ['correctOptionIds'], message: 'Pick the correct option(s)' });
    }
    if (!value.multiple && value.correctOptionIds.length !== 1) {
      ctx.addIssue({ code: 'custom', path: ['correctOptionIds'], message: 'Single-answer questions have exactly one correct option' });
    }
  });
export type FindingKey = z.infer<typeof FindingKeySchema>;

export const REPORT_UNITS = ['mm', 'cm', 'g', 'd', 'wk', '%', 'bpm', 'none'] as const;
export const ReportUnitSchema = z.enum(REPORT_UNITS);
export type ReportUnit = z.infer<typeof ReportUnitSchema>;

/** UCUM units used in DICOM SR numeric items. */
export const UCUM: Record<ReportUnit, { value: string; meaning: string }> = {
  mm: { value: 'mm', meaning: 'millimeter' },
  cm: { value: 'cm', meaning: 'centimeter' },
  g: { value: 'g', meaning: 'gram' },
  d: { value: 'd', meaning: 'day' },
  wk: { value: 'wk', meaning: 'week' },
  '%': { value: '%', meaning: 'percent' },
  bpm: { value: '/min', meaning: 'per minute' },
  none: { value: '1', meaning: 'no units' },
};

export const ReportFieldKeySchema = z.object({
  id: ShortIdSchema,
  label: text(200),
  unit: ReportUnitSchema,
  value: z.number().finite(),
  /** Pass when |learner − value| ≤ tolerance (the "buffer"). */
  tolerance: z.number().min(0),
  marks,
  teachingPoint,
  /** A lesson resource (e.g. an online calculator) to work this value out with. */
  resourceId: z.string().nullable().default(null),
});
export type ReportFieldKey = z.infer<typeof ReportFieldKeySchema>;

/** Whether learners attach their working (explanation, photos of calculations). */
export const WORKING_MODES = ['OFF', 'OPTIONAL', 'REQUIRED'] as const;
export const WorkingSettingsSchema = z.object({
  mode: z.enum(WORKING_MODES),
  /** What to show learners, e.g. "Show how you calculated EFW and its centile". */
  prompt: z.string().trim().max(1000).nullable().default(null),
});
export type WorkingSettings = z.infer<typeof WorkingSettingsSchema>;
export const DEFAULT_WORKING: WorkingSettings = { mode: 'OPTIONAL', prompt: null };

/** Learners may attach this many photos / PDFs of their working. */
export const MAX_WORKING_FILES = 6;

export const ImagingCaseInputSchema = z
  .object({
    instructions: z.string().trim().max(10_000),
    /** Lesson links, e.g. calculators (stored on the lesson). */
    resources: ResourceLinksSchema.default([]),
    working: WorkingSettingsSchema.default(DEFAULT_WORKING),
    images: z.array(z.object({ assetId: z.string().uuid(), label: text(100) })).min(1).max(20),
    annotations: z.array(AnnotationKeySchema).max(60),
    findings: z.array(FindingKeySchema).max(30),
    reportFields: z.array(ReportFieldKeySchema).max(20),
  })
  .superRefine((value, ctx) => {
    if (value.annotations.length + value.findings.length + value.reportFields.length === 0) {
      ctx.addIssue({ code: 'custom', path: ['annotations'], message: 'Add at least one annotation, finding or report field' });
    }
    const assets = new Set(value.images.map((image) => image.assetId));
    const ids = new Set<string>();
    [...value.annotations, ...value.findings, ...value.reportFields].forEach((item, index) => {
      if (ids.has(item.id)) ctx.addIssue({ code: 'custom', path: ['annotations', index, 'id'], message: 'Duplicate id' });
      ids.add(item.id);
    });
    value.annotations.forEach((annotation, index) => {
      if (!assets.has(annotation.assetId)) {
        ctx.addIssue({ code: 'custom', path: ['annotations', index, 'assetId'], message: 'Annotation is on an image that is not in this case' });
      }
    });
    const resourceIds = new Set(value.resources.map((r) => r.id));
    value.reportFields.forEach((field, index) => {
      if (field.resourceId && !resourceIds.has(field.resourceId)) {
        ctx.addIssue({ code: 'custom', path: ['reportFields', index, 'resourceId'], message: `"${field.label}" points at a calculator that was removed` });
      }
    });
    value.findings.forEach((finding, index) =>
      finding.options.forEach((option) => {
        if (option.assetId && !assets.has(option.assetId)) {
          ctx.addIssue({ code: 'custom', path: ['findings', index], message: `"${option.label}" points at an image that is not in this case` });
        }
      }),
    );
  });
export type ImagingCaseInput = z.infer<typeof ImagingCaseInputSchema>;

export const InstructorImagingCaseSchema = z.object({
  instructions: z.string(),
  images: z.array(ImagingImageSchema),
  /** referenceMm: the key's own value for LENGTH/ELLIPSE, else null. */
  annotations: z.array(AnnotationKeySchema.innerType().extend({ referenceMm: z.number().nullable() })),
  findings: z.array(FindingKeySchema.innerType()),
  reportFields: z.array(ReportFieldKeySchema),
  resources: z.array(ResourceLinkSchema),
  working: WorkingSettingsSchema,
  referenceSrAssetId: z.string().uuid().nullable(),
});
export type InstructorImagingCase = z.infer<typeof InstructorImagingCaseSchema>;

// ---- Learner ----------------------------------------------------------------

const ReferenceDrawingSchema = z.preprocess(
  (value) => {
    // Results stored before labels/tools existed carried `concept` only.
    const v = value as { concept?: string; label?: string; tool?: string; coords?: unknown[] } | null;
    if (!v || v.label) return value;
    return { ...v, label: v.concept, tool: v.tool ?? (v.coords?.length === 4 ? 'ELLIPSE' : 'LENGTH') };
  },
  z.object({ assetId: z.string().uuid(), frame: z.number().int(), label: z.string(), tool: AnnotationToolSchema, coords: z.array(PointSchema) }),
);

export const ImagingResultItemSchema = z.object({
  id: z.string(),
  kind: z.enum(['ANNOTATION', 'MEASUREMENT', 'FINDING', 'REPORT_FIELD']),
  label: z.string(),
  marks: z.number().int(),
  /** May be fractional (half marks for partial overlap, partial credit). */
  earned: z.number(),
  passed: z.boolean(),
  /** e.g. "175.0 mm ± 5 mm", "overlap ≥ 50%". */
  expected: z.string(),
  /** What the learner reported, or null if missing. */
  actual: z.string().nullable(),
  /** MISSING, VALUE, POSITION, OVERLAP, MISMATCH (reported value ≠ drawing), WRONG, PARTIAL. */
  reason: z.enum(['MISSING', 'VALUE', 'POSITION', 'OVERLAP', 'MISMATCH', 'WRONG', 'PARTIAL']).nullable(),
  /** Reference drawing, shown after submission. */
  reference: ReferenceDrawingSchema.nullable(),
  teachingPoint: z.string().nullable().default(null),
});
export type ImagingResultItem = z.infer<typeof ImagingResultItemSchema>;

export const WORKING_STATUSES = ['PENDING', 'VERIFIED', 'RETURNED'] as const;
export const WorkingStatusSchema = z.enum(WORKING_STATUSES);
export type WorkingStatus = z.infer<typeof WorkingStatusSchema>;

/** A learner's working on one attempt, and the faculty check of it. */
export const AttemptWorkingSchema = z.object({
  explanation: z.string().nullable(),
  files: z.array(z.object({ assetId: z.string().uuid(), name: z.string(), kind: z.enum(['IMAGE', 'PDF']) })),
  status: WorkingStatusSchema,
  feedback: z.string().nullable(),
  reviewedAt: z.string().datetime().nullable(),
  reviewedBy: z.string().nullable(),
});
export type AttemptWorking = z.infer<typeof AttemptWorkingSchema>;

/** Faculty verdict on a learner's working. */
export const WorkingReviewSchema = z
  .object({
    status: z.enum(['VERIFIED', 'RETURNED']),
    feedback: z.string().trim().max(2000).nullable(),
  })
  .refine((v) => v.status === 'VERIFIED' || !!v.feedback, { message: 'Say what needs correcting', path: ['feedback'] });
export type WorkingReview = z.infer<typeof WorkingReviewSchema>;

export const ImagingResultSchema = z.object({
  attemptId: z.string().uuid(),
  scorePercent: z.number().int(),
  passed: z.boolean(),
  passPercent: z.number().int(),
  createdAt: z.string().datetime(),
  /** The learner's DICOM SR, downloadable. */
  srAssetId: z.string().uuid(),
  items: z.array(ImagingResultItemSchema),
  working: AttemptWorkingSchema.nullable().default(null),
});
export type ImagingResult = z.infer<typeof ImagingResultSchema>;

export const ImagingCasePublicSchema = z.object({
  instructions: z.string(),
  passPercent: z.number().int(),
  images: z.array(ImagingImageSchema),
  /** The course's shorthand dictionary: which label to use for what. */
  dictionary: z.array(AnnotationTermSchema),
  /** What to annotate (no answers). */
  tasks: z.array(z.object({ id: z.string(), label: z.string(), tool: AnnotationToolSchema, assetId: z.string().uuid() })),
  findings: z.array(
    z.object({
      id: z.string(),
      label: z.string(),
      multiple: z.boolean(),
      options: z.array(z.object({ id: z.string(), label: z.string(), assetId: z.string().uuid().nullable() })),
    }),
  ),
  reportFields: z.array(
    z.object({ id: z.string(), label: z.string(), unit: ReportUnitSchema, resourceId: z.string().nullable().default(null) }),
  ),
  working: WorkingSettingsSchema.default(DEFAULT_WORKING),
  lastResult: ImagingResultSchema.nullable(),
});
export type ImagingCasePublic = z.infer<typeof ImagingCasePublicSchema>;

/** The learner's report: a DICOM SR built in the browser, base64-encoded. */
export const ImagingSubmitSchema = z.object({
  sr: z.string().min(100).max(4_000_000),
  /** Working: how the learner reached their values… */
  explanation: z.string().trim().max(5000).nullable().default(null),
  /** …and their uploaded photos / PDFs of handwritten calculations. */
  workingAssetIds: z.array(z.string().uuid()).max(MAX_WORKING_FILES).default([]),
});
export type ImagingSubmit = z.infer<typeof ImagingSubmitSchema>;
