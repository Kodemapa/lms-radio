import { ellipseCoords, measureMm, regionPolygon, type ParsedAnnotation } from '@obgyn/dicom';
import { DEFAULT_WORKING, type AnnotationTerm, type AnnotationTool, type Calibration, type Point } from '@obgyn/types';
import { gradeImaging, readKey, type CaseKey, type GradingImage, type KeyAnnotation } from './grading';

const ASSET = '6f1c2a3b-0000-4000-8000-000000000001';
const SOP = '1.2.3.4';
const cal: Calibration = { mmPerPxX: 0.2, mmPerPxY: 0.2, source: 'US_REGION' };
const images = new Map<string, GradingImage>([[ASSET, { sopInstanceUID: SOP, calibration: cal, columns: 800 }]]);
const dictionary: AnnotationTerm[] = [
  { abbr: 'CSP', name: 'Cavum septi pellucidi', description: null, loinc: null, tools: ['POINT'] },
  { abbr: 'STOM', name: 'Stomach bubble', description: null, loinc: null, tools: ['BOX', 'POLYGON'] },
  { abbr: 'HC', name: 'Head circumference', description: null, loinc: '11984-2', tools: ['ELLIPSE'] },
];

const refEllipse = ellipseCoords([400, 300], 300, 240, 0.4);
const keyItem = (over: Partial<KeyAnnotation> & Pick<KeyAnnotation, 'id' | 'label' | 'tool' | 'coords'>): KeyAnnotation => ({
  assetId: ASSET, frame: 1, valueToleranceMm: null, valueTolerancePercent: null, positionToleranceMm: null,
  radiusPercent: null, iouFull: null, iouHalf: null, marks: 1, teachingPoint: null, referenceMm: null, ...over,
});

const key: CaseKey = {
  annotations: [
    keyItem({ id: 'hc', label: 'HC', tool: 'ELLIPSE', coords: refEllipse, valueToleranceMm: 5, positionToleranceMm: 4, marks: 2, referenceMm: measureMm('ELLIPSE', refEllipse, cal), teachingPoint: 'Outer to outer.' }),
    keyItem({ id: 'fl', label: 'FL', tool: 'LENGTH', coords: [[100, 100], [400, 100]], valueTolerancePercent: 5, referenceMm: 60 }),
    keyItem({ id: 'csp', label: 'CSP', tool: 'POINT', coords: [[200, 200]], positionToleranceMm: 3 }),
    keyItem({ id: 'stom', label: 'STOM', tool: 'BOX', coords: [[100, 100], [200, 200]], iouFull: 0.5, iouHalf: 0.3 }),
  ],
  findings: [
    { id: 'plane', label: 'Plane', multiple: false, maxWrong: 0, marks: 1, teachingPoint: null, correctOptionIds: ['tt'],
      options: [{ id: 'tt', label: 'Transthalamic', assetId: null, credit: 0 }, { id: 'tv', label: 'Transventricular', assetId: null, credit: 50 }, { id: 'tc', label: 'Transcerebellar', assetId: null, credit: 0 }] },
    { id: 'ddx', label: 'Differentials', multiple: true, maxWrong: 1, marks: 1, teachingPoint: null, correctOptionIds: ['a', 'b'],
      options: ['a', 'b', 'c', 'd'].map((id) => ({ id, label: id.toUpperCase(), assetId: null, credit: 0 })) },
  ],
  reportFields: [{ id: 'ga', label: 'GA', unit: 'd', value: 140, tolerance: 3, marks: 1, teachingPoint: null, resourceId: null }],
  working: DEFAULT_WORKING,
};

const code = (label: string) => {
  if (label === 'HC') return { value: '11984-2', scheme: 'LN', meaning: 'HC' };
  if (label === 'FL') return { value: '11963-6', scheme: 'LN', meaning: 'FL' };
  return { value: label.toUpperCase(), scheme: '99OBGLMS', meaning: label };
};
const ann = (label: string, tool: AnnotationTool, coords: Point[], value: number | null = null): ParsedAnnotation => ({
  trackingId: 'x', code: code(label), tool, value, unit: value === null ? null : 'mm',
  graphicType: tool, coords, sopInstanceUID: SOP, frame: 1,
});
const hc = (coords: Point[], value = measureMm('ELLIPSE', coords, cal)) => ann('HC', 'ELLIPSE', coords, value);
const report = (annotations: ParsedAnnotation[], findings: [string, string[]][] = [['plane', ['tt']], ['ddx', ['a', 'b']]], fields: [string, number][] = [['ga', 141]]) => ({
  annotations, findings: new Map(findings), reportFields: new Map(fields),
});
const grade = (r: ReturnType<typeof report>) => gradeImaging(key, images, r, 70, dictionary);
const item = (r: ReturnType<typeof grade>, id: string) => r.items.find((i) => i.id === id)!;

const perfect = [
  hc(ellipseCoords([401, 301], 301, 240, 0.41)),
  ann('FL', 'LENGTH', [[100, 100], [398, 101]], measureMm('LENGTH', [[100, 100], [398, 101]], cal)),
  ann('csp', 'POINT', [[205, 200]]), // 1 mm away, label typed in lower case
  ann('STOM', 'POLYGON', regionPolygon('BOX', [[102, 101], [201, 199]])),
];

describe('gradeImaging', () => {
  it('passes everything within tolerance', () => {
    const result = grade(report(perfect));
    expect(result.items.map((i) => [i.id, i.passed])).toEqual([['hc', true], ['fl', true], ['csp', true], ['stom', true], ['plane', true], ['ddx', true], ['ga', true]]);
    expect(result.scorePercent).toBe(100);
    expect(item(result, 'hc').label).toBe('HC — Head circumference');
    expect(item(result, 'hc').teachingPoint).toBe('Outer to outer.');
  });

  it('measurements: value, placement and typed-value mismatch', () => {
    expect(item(grade(report([hc(ellipseCoords([400, 300], 330, 260, 0.4))])), 'hc').reason).toBe('VALUE');
    const moved = item(grade(report([hc(ellipseCoords([460, 300], 300, 240, 0.4))])), 'hc');
    expect(moved.reason).toBe('POSITION');
    expect(moved.actual).toMatch(/placed 12\.0 mm from reference/);
    expect(item(grade(report([hc(refEllipse, 10)])), 'hc').reason).toBe('MISMATCH');
  });

  it('landmark pins: inside or outside the radius', () => {
    expect(item(grade(report([ann('CSP', 'POINT', [[214, 200]])])), 'csp')).toMatchObject({ passed: true, actual: '2.8 mm from the landmark' });
    expect(item(grade(report([ann('CSP', 'POINT', [[216, 200]])])), 'csp')).toMatchObject({ passed: false, reason: 'POSITION' });
  });

  it('pin radius as % of image width works without calibration', () => {
    const uncalibrated = new Map<string, GradingImage>([[ASSET, { sopInstanceUID: SOP, calibration: null, columns: 800 }]]);
    const pinKey: CaseKey = { annotations: [keyItem({ id: 'p', label: 'CSP', tool: 'POINT', coords: [[200, 200]], radiusPercent: 5 })], findings: [], reportFields: [], working: DEFAULT_WORKING };
    const near = gradeImaging(pinKey, uncalibrated, report([ann('CSP', 'POINT', [[230, 200]])], [], []), 70, dictionary); // 30 px = 3.75%
    expect(near.items[0]!.passed).toBe(true);
    const far = gradeImaging(pinKey, uncalibrated, report([ann('CSP', 'POINT', [[250, 200]])], [], []), 70, dictionary); // 6.25%
    expect(far.items[0]!.passed).toBe(false);
  });

  it('regions: full, half and no marks by overlap', () => {
    const shifted = (dx: number) => ann('STOM', 'POLYGON', regionPolygon('BOX', [[100 + dx, 100], [200 + dx, 200]]));
    expect(item(grade(report([shifted(20)])), 'stom')).toMatchObject({ earned: 1, passed: true }); // IoU 0.67
    expect(item(grade(report([shifted(50)])), 'stom')).toMatchObject({ earned: 0.5, passed: false, reason: 'PARTIAL' }); // IoU 0.33
    expect(item(grade(report([shifted(70)])), 'stom')).toMatchObject({ earned: 0, reason: 'OVERLAP' }); // IoU 0.18
  });

  it('labels must match the dictionary abbreviation; other labels do not count', () => {
    expect(item(grade(report([ann('cavum', 'POINT', [[200, 200]])])), 'csp').reason).toBe('MISSING');
  });

  it('findings: partial credit for close answers, ≤ N wrong picks for multi-select', () => {
    const close = grade(report([], [['plane', ['tv']], ['ddx', ['a', 'b', 'c']]]));
    expect(item(close, 'plane')).toMatchObject({ earned: 0.5, reason: 'PARTIAL' });
    expect(item(close, 'ddx').passed).toBe(true); // one wrong pick allowed
    const bad = grade(report([], [['plane', ['tc']], ['ddx', ['a', 'c', 'd']]]));
    expect(item(bad, 'plane')).toMatchObject({ earned: 0, reason: 'WRONG' });
    expect(item(bad, 'ddx')).toMatchObject({ passed: false, reason: 'WRONG' }); // missed b
  });

  it('ignores annotations on another image, frame or with an incompatible tool', () => {
    const other = { ...hc(refEllipse), sopInstanceUID: '9.9.9' };
    const wrongTool = ann('HC', 'LENGTH', [[100, 100], [200, 100]], 20);
    expect(item(grade(report([other, wrongTool])), 'hc').reason).toBe('MISSING');
  });

  it('reads keys saved in the first format', () => {
    const old = readKey({
      measurements: [{ id: 'hc', concept: 'HC', assetId: ASSET, frame: 1, coords: refEllipse, valueToleranceMm: 5, valueTolerancePercent: null, positionToleranceMm: null, marks: 1, referenceMm: 100 }],
      findings: [{ id: 'f', label: 'Q', options: [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }], correctOptionId: 'a', marks: 1 }],
      reportFields: [],
    });
    expect(old.annotations[0]).toMatchObject({ label: 'HC', tool: 'ELLIPSE', iouFull: null, teachingPoint: null });
    expect(old.findings[0]).toMatchObject({ multiple: false, correctOptionIds: ['a'] });
    expect(old.findings[0]!.options[0]).toMatchObject({ assetId: null, credit: 0 });
  });
});
