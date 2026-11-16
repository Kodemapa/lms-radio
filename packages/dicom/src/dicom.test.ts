import { type Calibration } from '@obgyn/types';
import { describe, expect, it } from 'vitest';
import { ellipseCoords, ellipsePerimeter, measureMm, placementErrorMm, pointDistance, polygonIoU, regionPolygon } from './geometry.js';
import { DicomError, deidentifyImage, imageMeta, inspectImage, readDicom, setPixelSpacing } from './image.js';
import { buildMeasurementReport, parseMeasurementReport, SrError } from './sr.js';
import { makeTestImage } from './test-image.js';

const cal: Calibration = { mmPerPxX: 0.5, mmPerPxY: 0.5, source: 'US_REGION' };

describe('geometry', () => {
  it('measures caliper length in mm', () => {
    expect(measureMm('LENGTH', [[0, 0], [30, 40]], cal)).toBeCloseTo(25);
  });

  it('measures a circle circumference exactly and a rotated ellipse consistently', () => {
    expect(ellipsePerimeter(10, 10)).toBeCloseTo(2 * Math.PI * 10, 6);
    const flat = measureMm('ELLIPSE', ellipseCoords([100, 100], 120, 90, 0), cal);
    const rotated = measureMm('ELLIPSE', ellipseCoords([100, 100], 120, 90, 0.7), cal);
    expect(rotated).toBeCloseTo(flat, 6);
    // a=60mm, b=45mm → 331.55 mm (Ramanujan II)
    expect(flat).toBeCloseTo(331.55, 1);
  });

  it('scores placement regardless of caliper order', () => {
    expect(placementErrorMm('LENGTH', [[10, 0], [0, 0]], [[0, 0], [10, 0]], cal)).toBe(0);
    expect(placementErrorMm('LENGTH', [[0, 0], [14, 0]], [[0, 0], [10, 0]], cal)).toBeCloseTo(2);
  });

  it('scores ellipse placement by centre and axes', () => {
    const ref = ellipseCoords([100, 100], 100, 80, 0.3);
    expect(placementErrorMm('ELLIPSE', ref, ref, cal)).toBeCloseTo(0);
    const shifted = ellipseCoords([106, 100], 100, 80, 0.3);
    expect(placementErrorMm('ELLIPSE', shifted, ref, cal)).toBeCloseTo(3);
  });
});

describe('regions and pins', () => {
  it('computes overlap (IoU) of boxes and polygons', () => {
    const box = regionPolygon('BOX', [[0, 0], [10, 10]]);
    expect(polygonIoU(box, box)).toBeCloseTo(1, 2);
    // half-shifted box: overlap 50, union 150 → 1/3
    expect(polygonIoU(box, regionPolygon('BOX', [[5, 0], [15, 10]]))).toBeCloseTo(1 / 3, 2);
    expect(polygonIoU(box, regionPolygon('BOX', [[20, 20], [30, 30]]))).toBe(0);
    // a triangle is half of its bounding square
    expect(polygonIoU([[0, 0], [10, 0], [0, 10]], box)).toBeCloseTo(0.5, 1);
  });

  it('measures pin distance in mm and % of image width', () => {
    expect(pointDistance([0, 0], [30, 40], 500, cal)).toEqual({ mm: 25, percent: 10 });
    expect(pointDistance([0, 0], [30, 40], 500, null)).toEqual({ mm: null, percent: 10 });
  });
});

describe('de-identification', () => {
  it('removes identifying attributes, private tags and replaces UIDs', () => {
    const original = makeTestImage();
    const before = imageMeta(readDicom(original).dict);
    const { bytes, meta } = deidentifyImage(original, 'CASE1');
    const dict = readDicom(bytes).dict;
    const text = JSON.stringify(dict);
    for (const secret of ['Sharma', 'MRN-123456', '19920314', 'City Hospital', 'Rao', 'ACC42', 'baby looks well', 'private vendor note']) {
      expect(text).not.toContain(secret);
    }
    expect(dict['00100010']?.Value?.[0]).toEqual({ Alphabetic: 'Anonymous^CASE1' });
    expect(dict['00120062']?.Value?.[0]).toBe('YES');
    expect(meta.sopInstanceUID).not.toBe(before.sopInstanceUID);
    expect(meta.studyInstanceUID).not.toBe(before.studyInstanceUID);
    expect(meta.calibration?.mmPerPxX).toBeCloseTo(0.2);
    expect(meta.calibration?.source).toBe('US_REGION');
    expect(meta.rows).toBe(64);
    // pixels untouched
    expect(readDicom(bytes).dict['7FE00010']).toBeDefined();
  });

  it('falls back to Pixel Spacing and rejects non-DICOM / non-image files', () => {
    const plain = makeTestImage({ extra: { SequenceOfUltrasoundRegions: undefined, PixelSpacing: [0.3, 0.25] } });
    expect(imageMeta(readDicom(plain).dict).calibration).toEqual({ mmPerPxX: 0.25, mmPerPxY: 0.3, source: 'PIXEL_SPACING' });
    expect(() => deidentifyImage(new Uint8Array([1, 2, 3]), 'X')).toThrow(DicomError);
    expect(() => deidentifyImage(makeTestImage({ extra: { PixelData: undefined } }), 'X')).toThrow(/NOT_IMAGE/);
  });
});

describe('scale', () => {
  it('sets pixel spacing and drops ultrasound regions', () => {
    const { bytes, meta } = setPixelSpacing(makeTestImage(), 0.22);
    expect(meta.calibration).toEqual({ mmPerPxX: 0.22, mmPerPxY: 0.22, source: 'PIXEL_SPACING' });
    expect(readDicom(bytes).dict['00186011']).toBeUndefined();
    expect(inspectImage(bytes).photometric).toBe('MONOCHROME2');
    expect(() => setPixelSpacing(makeTestImage(), 0)).toThrow(DicomError);
  });
});

describe('DICOM SR (TID 1500)', () => {
  const { meta } = deidentifyImage(makeTestImage(), 'CASE1');
  const ellipse = ellipseCoords([40, 32], 20, 15, 0.4);
  const hcCode = { value: '11984-2', scheme: 'LN', meaning: 'Head Circumference' };
  const local = (v: string, m: string) => ({ value: v, scheme: '99OBGLMS', meaning: m });
  const common = { image: meta, frame: 1 };

  const sr = buildMeasurementReport({
    images: [meta],
    patient: { name: 'Anonymous^CASE1', id: 'CASE1' },
    observer: 'Learner^u1234',
    title: 'Mixed exercise',
    annotations: [
      { trackingId: 'm1', code: hcCode, tool: 'ELLIPSE', valueMm: measureMm('ELLIPSE', ellipse, meta.calibration!), coords: ellipse, ...common },
      { trackingId: 'm2', code: { value: '11820-8', scheme: 'LN', meaning: 'Biparietal Diameter' }, tool: 'LENGTH', valueMm: 6.5, coords: [[10, 10], [40.5, 10]], ...common },
      { trackingId: 'p1', code: local('CSP', 'Cavum septi pellucidi'), tool: 'POINT', valueMm: null, coords: [[12, 13]], ...common },
      { trackingId: 'b1', code: local('STOMACH', 'Stomach bubble'), tool: 'BOX', valueMm: null, coords: [[5, 6], [25, 20]], ...common },
      { trackingId: 'g1', code: local('CBL', 'Cerebellum'), tool: 'POLYGON', valueMm: null, coords: [[1, 1], [9, 2], [5, 8]], ...common },
    ],
    findings: [
      { id: 'plane', label: 'Which plane?', optionId: 'tt', optionLabel: 'Transthalamic' },
      { id: 'ddx', label: 'Differentials', optionId: 'a', optionLabel: 'Option A' },
      { id: 'ddx', label: 'Differentials', optionId: 'c', optionLabel: 'Option C' },
    ],
    reportFields: [{ id: 'ga', label: 'Gestational age', unit: 'd', value: 140 }],
  });

  it('round-trips calipers, ellipses, pins, boxes and polygons', () => {
    const parsed = parseMeasurementReport(sr);
    expect(parsed.templateId).toBe('1500');
    expect(parsed.studyInstanceUID).toBe(meta.studyInstanceUID);
    const by = (v: string) => parsed.annotations.find((a) => a.code.value === v)!;
    expect(parsed.annotations).toHaveLength(5);
    expect(by('11984-2')).toMatchObject({ trackingId: 'm1', tool: 'ELLIPSE', unit: 'mm', sopInstanceUID: meta.sopInstanceUID });
    expect(by('11984-2').coords[0]![0]).toBeCloseTo(ellipse[0]![0], 2);
    expect(by('11820-8')).toMatchObject({ tool: 'LENGTH', value: 6.5 });
    expect(by('CSP')).toMatchObject({ trackingId: 'p1', tool: 'POINT', value: null, coords: [[12, 13]], code: local('CSP', 'Cavum septi pellucidi') });
    // a box is written as a closed 4-vertex polygon and read back without the closing vertex
    expect(by('STOMACH')).toMatchObject({ tool: 'POLYGON', coords: [[5, 6], [25, 6], [25, 20], [5, 20]] });
    expect(by('CBL').coords).toEqual([[1, 1], [9, 2], [5, 8]]);
  });

  it('round-trips single and multiple-choice findings and report values', () => {
    const parsed = parseMeasurementReport(sr);
    expect(parsed.findings.get('plane')).toEqual(['tt']);
    expect(parsed.findings.get('ddx')).toEqual(['a', 'c']);
    expect(parsed.reportFields.get('ga')).toBe(140);
    expect(parsed.texts).toEqual(expect.arrayContaining(['Transthalamic', 'Cavum septi pellucidi']));
  });

  it('refuses files that are not SRs', () => {
    expect(() => parseMeasurementReport(makeTestImage())).toThrow(SrError);
    expect(() => parseMeasurementReport(new Uint8Array(10))).toThrow(SrError);
  });
});
