import { LOCAL_CODING_SCHEME, type AnnotationTool, type DicomImageMeta, type Point, type ReportUnit, UCUM } from '@obgyn/types';
import dcmjs from 'dcmjs';
import { regionPolygon } from './geometry.js';
import { readDicom } from './image.js';

const { DicomDict, DicomMetaDictionary } = dcmjs.data;

/** Comprehensive SR: allows SCOORD (caliper/ellipse/region/point) content. */
export const COMPREHENSIVE_SR = '1.2.840.10008.5.1.4.1.1.88.33';
const EXPLICIT_LITTLE_ENDIAN = '1.2.840.10008.1.2.1';
/** Our private coding scheme for case-specific labels, findings and report fields. */
export const LOCAL_SCHEME = LOCAL_CODING_SCHEME;

type Code = { CodeValue: string; CodingSchemeDesignator: string; CodeMeaning: string };
type Item = Record<string, unknown>;
export type LabelCode = { value: string; scheme: string; meaning: string };

/** CodeMeaning is LO (≤64 chars). */
const code = (value: string, scheme: string, meaning: string): Code => ({
  CodeValue: value,
  CodingSchemeDesignator: scheme,
  CodeMeaning: meaning.slice(0, 64),
});

const DCM = {
  report: code('126000', 'DCM', 'Imaging Measurement Report'),
  language: code('121049', 'DCM', 'Language of Content Item and Descendants'),
  observerType: code('121005', 'DCM', 'Observer Type'),
  person: code('121006', 'DCM', 'Person'),
  observerName: code('121008', 'DCM', 'Person Observer Name'),
  procedure: code('121058', 'DCM', 'Procedure reported'),
  imageLibrary: code('111028', 'DCM', 'Image Library'),
  measurements: code('126010', 'DCM', 'Imaging Measurements'),
  group: code('125007', 'DCM', 'Measurement Group'),
  trackingId: code('112039', 'DCM', 'Tracking Identifier'),
  trackingUid: code('112040', 'DCM', 'Tracking Unique Identifier'),
  finding: code('121071', 'DCM', 'Finding'),
  imageRegion: code('111030', 'DCM', 'Image Region'),
  qualitative: code('C0034375', 'UMLS', 'Qualitative Evaluations'),
};

export type ReportImage = Pick<DicomImageMeta, 'sopClassUID' | 'sopInstanceUID' | 'studyInstanceUID' | 'seriesInstanceUID'>;

export interface ReportAnnotation {
  trackingId: string;
  /** From `labelCode()`: LOINC for standard measurements, else the local scheme. */
  code: LabelCode;
  tool: AnnotationTool;
  /** LENGTH/ELLIPSE value in mm; null for points and regions. */
  valueMm: number | null;
  coords: Point[];
  image: ReportImage;
  frame: number;
}

export interface ReportInput {
  images: ReportImage[];
  /** De-identified patient name/ID copied from the images, so the SR joins their study. */
  patient: { name: string; id: string };
  observer: string;
  title: string;
  annotations: ReportAnnotation[];
  /** One entry per chosen option (multiple-choice findings repeat the id). */
  findings: { id: string; label: string; optionId: string; optionLabel: string }[];
  reportFields: { id: string; label: string; unit: ReportUnit; value: number }[];
  now?: Date;
}

const imageRef = (image: ReportImage, frame?: number) => ({
  ReferencedSOPClassUID: image.sopClassUID,
  ReferencedSOPInstanceUID: image.sopInstanceUID,
  ...(frame && frame > 1 ? { ReferencedFrameNumber: frame } : {}),
});

const round = (value: number) => Math.round(value * 100) / 100;
const flat = (points: Point[]) => points.flat().map((value) => Math.round(value * 1000) / 1000);

function scoord(a: ReportAnnotation, concept?: Code): Item {
  let graphicType: string;
  let points: Point[];
  if (a.tool === 'LENGTH') [graphicType, points] = ['POLYLINE', a.coords];
  else if (a.tool === 'ELLIPSE') [graphicType, points] = ['ELLIPSE', a.coords];
  else if (a.tool === 'POINT') [graphicType, points] = ['POINT', a.coords];
  else {
    // Closed polygon: DICOM repeats the first vertex at the end.
    const polygon = regionPolygon(a.tool, a.coords);
    [graphicType, points] = ['POLYGON', [...polygon, polygon[0]!]];
  }
  return {
    RelationshipType: concept ? 'CONTAINS' : 'INFERRED FROM',
    ValueType: 'SCOORD',
    ...(concept ? { ConceptNameCodeSequence: [concept] } : {}),
    GraphicType: graphicType,
    GraphicData: flat(points),
    ContentSequence: [{ RelationshipType: 'SELECTED FROM', ValueType: 'IMAGE', ReferencedSOPSequence: [imageRef(a.image, a.frame)] }],
  };
}

/**
 * One TID 1500 measurement group. Calipers/ellipses are a NUM (mm) inferred
 * from their SCOORD; points and regions follow the planar-ROI pattern: a
 * Finding code plus an "Image Region" SCOORD.
 */
function annotationGroup(a: ReportAnnotation): Item {
  const label = code(a.code.value, a.code.scheme, a.code.meaning);
  const body =
    a.tool === 'LENGTH' || a.tool === 'ELLIPSE'
      ? [
          {
            RelationshipType: 'CONTAINS',
            ValueType: 'NUM',
            ConceptNameCodeSequence: [label],
            MeasuredValueSequence: [{ NumericValue: round(a.valueMm ?? 0), MeasurementUnitsCodeSequence: [code('mm', 'UCUM', 'millimeter')] }],
            ContentSequence: [scoord(a)],
          },
        ]
      : [
          { RelationshipType: 'CONTAINS', ValueType: 'CODE', ConceptNameCodeSequence: [DCM.finding], ConceptCodeSequence: [label] },
          scoord(a, DCM.imageRegion),
        ];
  return {
    RelationshipType: 'CONTAINS',
    ValueType: 'CONTAINER',
    ConceptNameCodeSequence: [DCM.group],
    ContinuityOfContent: 'SEPARATE',
    ContentSequence: [
      { RelationshipType: 'HAS OBS CONTEXT', ValueType: 'TEXT', ConceptNameCodeSequence: [DCM.trackingId], TextValue: a.trackingId.slice(0, 64) },
      { RelationshipType: 'HAS OBS CONTEXT', ValueType: 'UIDREF', ConceptNameCodeSequence: [DCM.trackingUid], UID: DicomMetaDictionary.uid() },
      ...body,
    ],
  };
}

const pad = (value: number) => String(value).padStart(2, '0');

/**
 * Builds a DICOM Comprehensive SR following TID 1500 (Measurement Report):
 * calipers, ellipses, landmark points and regions with their SCOORD graphics
 * referencing the source images, plus case findings and report values as
 * qualitative evaluations. Works in the browser and in Node.
 */
export function buildMeasurementReport(input: ReportInput): ArrayBuffer {
  const now = input.now ?? new Date();
  const date = `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}`;
  const time = `${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}`;
  const first = input.images[0];
  if (!first) throw new Error('A report needs at least one image');
  const sopInstanceUID = DicomMetaDictionary.uid();

  const bySeries = new Map<string, ReportImage[]>();
  for (const image of input.images) bySeries.set(image.seriesInstanceUID, [...(bySeries.get(image.seriesInstanceUID) ?? []), image]);

  const qualitative: Item[] = [
    ...input.findings.map((finding) => ({
      RelationshipType: 'CONTAINS',
      ValueType: 'CODE',
      ConceptNameCodeSequence: [code(finding.id, LOCAL_SCHEME, finding.label)],
      ConceptCodeSequence: [code(finding.optionId, LOCAL_SCHEME, finding.optionLabel)],
    })),
    ...input.reportFields.map((field) => ({
      RelationshipType: 'CONTAINS',
      ValueType: 'NUM',
      ConceptNameCodeSequence: [code(field.id, LOCAL_SCHEME, field.label)],
      MeasuredValueSequence: [
        { NumericValue: field.value, MeasurementUnitsCodeSequence: [code(UCUM[field.unit].value, 'UCUM', UCUM[field.unit].meaning)] },
      ],
    })),
  ];

  const dataset = {
    SOPClassUID: COMPREHENSIVE_SR,
    SOPInstanceUID: sopInstanceUID,
    StudyInstanceUID: first.studyInstanceUID,
    SeriesInstanceUID: DicomMetaDictionary.uid(),
    Modality: 'SR',
    SeriesNumber: 900,
    InstanceNumber: 1,
    PatientName: { Alphabetic: input.patient.name },
    PatientID: input.patient.id,
    PatientBirthDate: '',
    PatientSex: '',
    StudyDate: '',
    StudyTime: '',
    ReferringPhysicianName: '',
    StudyID: '',
    AccessionNumber: '',
    Manufacturer: 'GIFS e-LMS',
    SeriesDescription: input.title.slice(0, 64),
    ContentDate: date,
    ContentTime: time,
    ValueType: 'CONTAINER',
    ConceptNameCodeSequence: [DCM.report],
    ContinuityOfContent: 'SEPARATE',
    CompletionFlag: 'COMPLETE',
    VerificationFlag: 'UNVERIFIED',
    ContentTemplateSequence: [{ MappingResource: 'DCMR', TemplateIdentifier: '1500' }],
    CurrentRequestedProcedureEvidenceSequence: [
      {
        StudyInstanceUID: first.studyInstanceUID,
        ReferencedSeriesSequence: [...bySeries].map(([seriesUID, images]) => ({
          SeriesInstanceUID: seriesUID,
          ReferencedSOPSequence: images.map((image) => imageRef(image)),
        })),
      },
    ],
    ContentSequence: [
      { RelationshipType: 'HAS CONCEPT MOD', ValueType: 'CODE', ConceptNameCodeSequence: [DCM.language], ConceptCodeSequence: [code('en', 'RFC5646', 'English')] },
      { RelationshipType: 'HAS OBS CONTEXT', ValueType: 'CODE', ConceptNameCodeSequence: [DCM.observerType], ConceptCodeSequence: [DCM.person] },
      { RelationshipType: 'HAS OBS CONTEXT', ValueType: 'PNAME', ConceptNameCodeSequence: [DCM.observerName], PersonName: { Alphabetic: input.observer } },
      { RelationshipType: 'HAS CONCEPT MOD', ValueType: 'CODE', ConceptNameCodeSequence: [DCM.procedure], ConceptCodeSequence: [code('IMGCASE', LOCAL_SCHEME, 'Imaging case exercise')] },
      {
        RelationshipType: 'CONTAINS',
        ValueType: 'CONTAINER',
        ConceptNameCodeSequence: [DCM.imageLibrary],
        ContinuityOfContent: 'SEPARATE',
        ContentSequence: input.images.map((image) => ({ RelationshipType: 'CONTAINS', ValueType: 'IMAGE', ReferencedSOPSequence: [imageRef(image)] })),
      },
      {
        RelationshipType: 'CONTAINS',
        ValueType: 'CONTAINER',
        ConceptNameCodeSequence: [DCM.measurements],
        ContinuityOfContent: 'SEPARATE',
        ContentSequence: input.annotations.map(annotationGroup),
      },
      ...(qualitative.length
        ? [{ RelationshipType: 'CONTAINS', ValueType: 'CONTAINER', ConceptNameCodeSequence: [DCM.qualitative], ContinuityOfContent: 'SEPARATE', ContentSequence: qualitative }]
        : []),
    ],
  };

  const meta = DicomMetaDictionary.denaturalizeDataset({
    FileMetaInformationVersion: new Uint8Array([0, 1]).buffer,
    MediaStorageSOPClassUID: COMPREHENSIVE_SR,
    MediaStorageSOPInstanceUID: sopInstanceUID,
    TransferSyntaxUID: EXPLICIT_LITTLE_ENDIAN,
    ImplementationClassUID: '2.25.80302813137786398554742050926734630921',
    ImplementationVersionName: 'OBGYN-ELMS-1',
  });
  const dict = new DicomDict(meta);
  dict.dict = DicomMetaDictionary.denaturalizeDataset(dataset);
  return dict.write();
}

// ---- Reading ----------------------------------------------------------------

export interface ParsedAnnotation {
  trackingId: string | null;
  code: LabelCode;
  /** Derived from the graphic: POINT, POLYGON (regions), LENGTH (2-point polyline) or ELLIPSE. */
  tool: AnnotationTool | null;
  value: number | null;
  unit: string | null;
  graphicType: string | null;
  /** Polygons without the repeated closing vertex. */
  coords: Point[];
  sopInstanceUID: string | null;
  frame: number;
}
/** @deprecated use ParsedAnnotation */
export type ParsedMeasurement = ParsedAnnotation;

export interface ParsedReport {
  sopClassUID: string;
  sopInstanceUID: string;
  studyInstanceUID: string;
  templateId: string | null;
  annotations: ParsedAnnotation[];
  /** CODE items in our local scheme: finding id → chosen option ids. */
  findings: Map<string, string[]>;
  /** NUM items in our local scheme: field id → value. */
  reportFields: Map<string, number>;
  /** Every human-readable string, for compliance screening. */
  texts: string[];
}

export class SrError extends Error {
  constructor(readonly code: 'NOT_DICOM' | 'NOT_SR') {
    super(code);
  }
}

const list = <T = Item>(value: unknown): T[] => (Array.isArray(value) ? (value as T[]) : value ? [value as T] : []);
const firstCode = (value: unknown): Code | undefined => list<Code>(value)[0];
const asNumber = (value: unknown): number | null => {
  const n = Number(Array.isArray(value) ? value[0] : value);
  return Number.isFinite(n) ? n : null;
};
const isCode = (c: Code | undefined, ref: Code) => !!c && c.CodeValue === ref.CodeValue && c.CodingSchemeDesignator === ref.CodingSchemeDesignator;

function readScoord(scoord: Item | undefined): Pick<ParsedAnnotation, 'graphicType' | 'coords' | 'sopInstanceUID' | 'frame' | 'tool'> {
  if (!scoord) return { graphicType: null, coords: [], sopInstanceUID: null, frame: 1, tool: null };
  const data = list<number>(scoord.GraphicData).map(Number);
  let coords: Point[] = [];
  for (let i = 0; i + 1 < data.length; i += 2) coords.push([data[i]!, data[i + 1]!]);
  const graphicType = typeof scoord.GraphicType === 'string' ? scoord.GraphicType : null;
  if (graphicType === 'POLYGON' && coords.length > 3) {
    const [a, z] = [coords[0]!, coords.at(-1)!];
    if (a[0] === z[0] && a[1] === z[1]) coords = coords.slice(0, -1);
  }
  const tool: AnnotationTool | null =
    graphicType === 'POINT' ? 'POINT'
    : graphicType === 'POLYGON' ? 'POLYGON'
    : graphicType === 'ELLIPSE' ? 'ELLIPSE'
    : graphicType === 'POLYLINE' && coords.length === 2 ? 'LENGTH'
    : null;
  const image = list(scoord.ContentSequence).find((item) => item.ValueType === 'IMAGE');
  const ref = list(image?.ReferencedSOPSequence)[0];
  return {
    graphicType,
    coords,
    tool,
    sopInstanceUID: typeof ref?.ReferencedSOPInstanceUID === 'string' ? ref.ReferencedSOPInstanceUID : null,
    frame: asNumber(ref?.ReferencedFrameNumber) ?? 1,
  };
}

/** Reads a TID 1500-style SR (ours, or a compatible one) into plain data. */
export function parseMeasurementReport(bytes: ArrayBuffer | Uint8Array): ParsedReport {
  let dataset: Item;
  try {
    dataset = DicomMetaDictionary.naturalizeDataset(readDicom(bytes).dict);
  } catch {
    throw new SrError('NOT_DICOM');
  }
  const sopClassUID = String(dataset.SOPClassUID ?? '');
  if (!sopClassUID.startsWith('1.2.840.10008.5.1.4.1.1.88.') || dataset.ValueType !== 'CONTAINER') throw new SrError('NOT_SR');

  const report: ParsedReport = {
    sopClassUID,
    sopInstanceUID: String(dataset.SOPInstanceUID ?? ''),
    studyInstanceUID: String(dataset.StudyInstanceUID ?? ''),
    templateId: (list(dataset.ContentTemplateSequence)[0]?.TemplateIdentifier as string | undefined) ?? null,
    annotations: [],
    findings: new Map(),
    reportFields: new Map(),
    texts: [],
  };

  const walk = (items: Item[], context: { inQualitative: boolean }) => {
    // A measurement group's tracking id and Finding code apply to its region SCOORD.
    const trackingItem = items.find((item) => item.ValueType === 'TEXT' && isCode(firstCode(item.ConceptNameCodeSequence), DCM.trackingId));
    const trackingId = trackingItem ? String(trackingItem.TextValue ?? '') : null;
    const findingItem = items.find((item) => item.ValueType === 'CODE' && isCode(firstCode(item.ConceptNameCodeSequence), DCM.finding));
    const finding = firstCode(findingItem?.ConceptCodeSequence);

    for (const item of items) {
      const name = firstCode(item.ConceptNameCodeSequence);
      if (name?.CodeMeaning) report.texts.push(name.CodeMeaning);
      if (typeof item.TextValue === 'string') report.texts.push(item.TextValue);
      if (item.ValueType === 'CODE') {
        const value = firstCode(item.ConceptCodeSequence);
        if (value?.CodeMeaning) report.texts.push(value.CodeMeaning);
        if (context.inQualitative && name?.CodingSchemeDesignator === LOCAL_SCHEME && value?.CodingSchemeDesignator === LOCAL_SCHEME) {
          report.findings.set(name.CodeValue, [...(report.findings.get(name.CodeValue) ?? []), value.CodeValue]);
        }
      }
      if (item.ValueType === 'NUM' && name) {
        const measured = list(item.MeasuredValueSequence)[0];
        const value = asNumber(measured?.NumericValue);
        const unit = firstCode(measured?.MeasurementUnitsCodeSequence)?.CodeValue ?? null;
        if (context.inQualitative && name.CodingSchemeDesignator === LOCAL_SCHEME) {
          if (value !== null) report.reportFields.set(name.CodeValue, value);
        } else {
          report.annotations.push({
            trackingId,
            code: { value: name.CodeValue, scheme: name.CodingSchemeDesignator, meaning: name.CodeMeaning },
            value,
            unit,
            ...readScoord(list(item.ContentSequence).find((child) => child.ValueType === 'SCOORD')),
          });
        }
      }
      if (item.ValueType === 'SCOORD' && finding && isCode(name, DCM.imageRegion)) {
        report.annotations.push({
          trackingId,
          code: { value: finding.CodeValue, scheme: finding.CodingSchemeDesignator, meaning: finding.CodeMeaning },
          value: null,
          unit: null,
          ...readScoord(item),
        });
      }
      if (item.ContentSequence && item.ValueType === 'CONTAINER') {
        const qualitative = isCode(name, DCM.qualitative);
        walk(list(item.ContentSequence), { inQualitative: context.inQualitative || qualitative });
      }
    }
  };
  walk(list(dataset.ContentSequence), { inQualitative: false });
  return report;
}
