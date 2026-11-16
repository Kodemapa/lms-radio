import { type Calibration, type DicomImageMeta } from '@obgyn/types';
import dcmjs, { type DicomDictLike } from 'dcmjs';

const { DicomMessage, DicomMetaDictionary } = dcmjs.data;

type Element = { vr: string; Value?: unknown[] };
type RawDict = Record<string, Element>;

export class DicomError extends Error {
  constructor(readonly code: 'NOT_DICOM' | 'NOT_IMAGE' | 'UNSUPPORTED') {
    super(code);
  }
}

const SR_SOP_CLASS_PREFIX = '1.2.840.10008.5.1.4.1.1.88.';
const PIXEL_DATA = '7FE00010';

/** Copies a Node Buffer / Uint8Array into a standalone ArrayBuffer for dcmjs. */
export function toArrayBuffer(bytes: ArrayBuffer | Uint8Array): ArrayBuffer {
  if (bytes instanceof ArrayBuffer) return bytes;
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

export function readDicom(bytes: ArrayBuffer | Uint8Array): DicomDictLike {
  try {
    return DicomMessage.readFile(toArrayBuffer(bytes));
  } catch {
    throw new DicomError('NOT_DICOM');
  }
}

function first(dict: RawDict, tag: string): unknown {
  return dict[tag]?.Value?.[0];
}

function str(dict: RawDict, tag: string): string | null {
  const value = first(dict, tag);
  return value === undefined || value === null || value === '' ? null : String(value);
}

function num(dict: RawDict, tag: string): number | null {
  const value = Number(first(dict, tag));
  return Number.isFinite(value) ? value : null;
}

/**
 * Pixel size in mm. Ultrasound images carry it per region
 * (Sequence of Ultrasound Regions, physical deltas in cm); other images use
 * Pixel Spacing (row, column spacing in mm).
 */
export function calibrationOf(dict: RawDict): Calibration | null {
  const regions = (dict['00186011']?.Value ?? []) as RawDict[];
  for (const region of regions) {
    const spatial2d = num(region, '00186012') === 1;
    const cmX = num(region, '00186024') === 3;
    const cmY = num(region, '00186026') === 3;
    const dx = num(region, '0018602C');
    const dy = num(region, '0018602E');
    if (spatial2d && cmX && cmY && dx && dy && dx > 0 && dy > 0) {
      return { mmPerPxX: Math.abs(dx) * 10, mmPerPxY: Math.abs(dy) * 10, source: 'US_REGION' };
    }
  }
  const spacing = (dict['00280030']?.Value ?? []).map(Number);
  if (spacing.length === 2 && spacing.every((value) => Number.isFinite(value) && value > 0)) {
    return { mmPerPxX: spacing[1]!, mmPerPxY: spacing[0]!, source: 'PIXEL_SPACING' };
  }
  return null;
}

/** Header facts about an image; throws NOT_IMAGE for SRs and files without pixels. */
export function imageMeta(dict: RawDict): DicomImageMeta {
  const sopClassUID = str(dict, '00080016');
  if (!sopClassUID || sopClassUID.startsWith(SR_SOP_CLASS_PREFIX) || !dict[PIXEL_DATA]) {
    throw new DicomError('NOT_IMAGE');
  }
  const rows = num(dict, '00280010');
  const columns = num(dict, '00280011');
  if (!rows || !columns) throw new DicomError('NOT_IMAGE');
  return {
    sopClassUID,
    sopInstanceUID: str(dict, '00080018') ?? '',
    studyInstanceUID: str(dict, '0020000D') ?? '',
    seriesInstanceUID: str(dict, '0020000E') ?? '',
    modality: str(dict, '00080060'),
    rows,
    columns,
    frames: num(dict, '00280008') ?? 1,
    calibration: calibrationOf(dict),
    burnedInAnnotation: str(dict, '00280301')?.toUpperCase() === 'YES',
  };
}

/**
 * Attributes removed by our de-identification (a subset of the DICOM PS3.15
 * Basic Application Level Confidentiality Profile that covers what ultrasound
 * and radiography headers carry). Free-text comment fields go too: they are
 * where patient details — or a fetal sex note — tend to be typed.
 */
const REMOVE = [
  '00100030', '00100032', '00100040', '00101000', '00101001', '00101005', '00101010', '00101020', '00101030',
  '00101040', '00101060', '00101080', '00101081', '00101090', '00102000', '00102110', '00102150', '00102152',
  '00102154', '00102160', '00102180', '001021A0', '001021B0', '001021C0', '001021D0', '001021F0', '00104000',
  '00080080', '00080081', '00080082', '00080090', '00080092', '00080094', '00081010', '00081030', '0008103E',
  '00081040', '00081048', '00081049', '00081050', '00081052', '00081060', '00081062', '00081070', '00081072',
  '00081080', '00081110', '00081111', '00081120', '00081140', '00082111', '00181000', '00181030', '00181400',
  '00204000', '00321032', '00321033', '00321060', '00380010', '00380300', '00380500', '00400244', '00400245',
  '00400253', '00400254', '00400275', '00400280', '0040A124', '0040A730', '00880140', '00320012', '00321020',
  '00321021', '00324000', '00380400', '00400006', '00400241', '00400242', '00400243', '00402400', '00403001',
  '00080020', '00080021', '00080022', '00080023', '00080024', '00080025', '0008002A', '00080030', '00080031',
  '00080032', '00080033', '00080034', '00080035', '00080050', '00200010', '00080201',
];
const REMOVE_SET = new Set(REMOVE);

/** Private groups (odd) and overlay/curve groups (50xx, 60xx) may hold free text or graphics. */
function isDroppedGroup(tag: string): boolean {
  const group = parseInt(tag.slice(0, 4), 16);
  return group % 2 === 1 || (group >= 0x5000 && group <= 0x50ff) || (group >= 0x6000 && group <= 0x60ff);
}

function scrub(dict: RawDict): void {
  for (const tag of Object.keys(dict)) {
    if (REMOVE_SET.has(tag) || isDroppedGroup(tag)) {
      delete dict[tag];
      continue;
    }
    const element = dict[tag]!;
    if (element.vr === 'SQ' && Array.isArray(element.Value)) {
      for (const item of element.Value as RawDict[]) scrub(item);
    }
  }
}

export interface DeidentifiedImage {
  bytes: ArrayBuffer;
  meta: DicomImageMeta;
}

/**
 * De-identifies a DICOM image (CLAUDE.md rule 6): strips identifying and
 * free-text attributes and private tags, replaces study/series/instance UIDs,
 * and marks the file as de-identified. Pixel data is left untouched — burned-in
 * text is reported via `meta.burnedInAnnotation` and the uploader's attestation.
 */
export function deidentifyImage(bytes: ArrayBuffer | Uint8Array, pseudonym: string): DeidentifiedImage {
  const file = readDicom(bytes);
  imageMeta(file.dict); // validates it is an image before we rewrite it
  scrub(file.dict);
  const uid = () => DicomMetaDictionary.uid();
  const sopInstanceUID = uid();
  const set = (tag: string, vr: string, value: unknown) => {
    file.dict[tag] = { vr, Value: [value] };
  };
  set('00100010', 'PN', { Alphabetic: `Anonymous^${pseudonym}` });
  set('00100020', 'LO', pseudonym);
  set('0020000D', 'UI', uid());
  set('0020000E', 'UI', uid());
  set('00080018', 'UI', sopInstanceUID);
  if (file.dict['00200052']) set('00200052', 'UI', uid());
  set('00120062', 'CS', 'YES');
  set('00120063', 'LO', 'OBGYN e-LMS: PS3.15 basic profile subset, UIDs replaced, private tags removed');
  file.meta['00020003'] = { vr: 'UI', Value: [sopInstanceUID] };
  const meta = imageMeta(file.dict);
  return { bytes: file.write(), meta };
}

const { DicomDict } = dcmjs.data;

/** Writes a naturalized image dataset as a DICOM Part 10 file (explicit VR little endian). */
export function createImage(dataset: Record<string, unknown> & { SOPClassUID: string; SOPInstanceUID: string }): ArrayBuffer {
  const meta = DicomMetaDictionary.denaturalizeDataset({
    FileMetaInformationVersion: new Uint8Array([0, 1]).buffer,
    MediaStorageSOPClassUID: dataset.SOPClassUID,
    MediaStorageSOPInstanceUID: dataset.SOPInstanceUID,
    TransferSyntaxUID: '1.2.840.10008.1.2.1',
    ImplementationClassUID: '2.25.80302813137786398554742050926734630921',
  });
  const dict = new DicomDict(meta);
  // Declare the pixel VR up front (8-bit data is OB), so dcmjs doesn't have to guess.
  dict.dict = DicomMetaDictionary.denaturalizeDataset({ ...dataset, _vrMap: { PixelData: 'OB' } });
  return dict.write();
}

/** Header facts plus the colour model, for checks and tests. */
export function inspectImage(bytes: ArrayBuffer | Uint8Array): DicomImageMeta & { photometric: string | null; samplesPerPixel: number | null } {
  const dict = readDicom(bytes).dict;
  return { ...imageMeta(dict), photometric: str(dict, '00280004'), samplesPerPixel: num(dict, '00280002') };
}

/**
 * Sets an image's scale (faculty-entered mm per pixel, e.g. from the scanner's
 * depth marker). Writes Pixel Spacing and drops ultrasound regions so the new
 * scale is the one used everywhere.
 */
export function setPixelSpacing(bytes: ArrayBuffer | Uint8Array, mmPerPx: number): { bytes: ArrayBuffer; meta: DicomImageMeta } {
  if (!(mmPerPx > 0 && mmPerPx < 100)) throw new DicomError('UNSUPPORTED');
  const file = readDicom(bytes);
  imageMeta(file.dict);
  delete file.dict['00186011'];
  const spacing = Number(mmPerPx.toPrecision(10));
  file.dict['00280030'] = { vr: 'DS', Value: [spacing, spacing] };
  return { bytes: file.write(), meta: imageMeta(file.dict) };
}
