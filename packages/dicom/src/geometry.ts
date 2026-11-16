import { type Calibration, type MeasurementTool, type Point } from '@obgyn/types';

/** Converts image pixel coordinates to millimetres. */
function toMm([x, y]: Point, calibration: Calibration): Point {
  return [x * calibration.mmPerPxX, y * calibration.mmPerPxY];
}

function distance(a: Point, b: Point): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1]);
}

function midpoint(a: Point, b: Point): Point {
  return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
}

/** Ramanujan's second approximation; error < 0.01% for fetal head/abdomen shapes. */
export function ellipsePerimeter(semiMajor: number, semiMinor: number): number {
  const a = semiMajor;
  const b = semiMinor;
  if (a + b === 0) return 0;
  const h = ((a - b) / (a + b)) ** 2;
  return Math.PI * (a + b) * (1 + (3 * h) / (10 + Math.sqrt(4 - 3 * h)));
}

export interface EllipseMm {
  center: Point;
  semiMajor: number;
  semiMinor: number;
}

/** An ellipse stored as SCOORD ELLIPSE: [major end, major end, minor end, minor end]. */
export function ellipseMm(coords: Point[], calibration: Calibration): EllipseMm {
  const [m1, m2, n1, n2] = coords.map((point) => toMm(point, calibration)) as [Point, Point, Point, Point];
  const axisA = distance(m1, m2) / 2;
  const axisB = distance(n1, n2) / 2;
  return { center: midpoint(m1, m2), semiMajor: Math.max(axisA, axisB), semiMinor: Math.min(axisA, axisB) };
}

/**
 * The measured value in mm: caliper distance for LENGTH, circumference for
 * ELLIPSE. Assumes square-ish pixels (true for ultrasound); with anisotropic
 * pixels axes are scaled independently, which is exact only for unrotated ellipses.
 */
export function measureMm(tool: MeasurementTool, coords: Point[], calibration: Calibration): number {
  if (tool === 'LENGTH') {
    const [a, b] = coords.map((point) => toMm(point, calibration)) as [Point, Point];
    return distance(a, b);
  }
  const { semiMajor, semiMinor } = ellipseMm(coords, calibration);
  return ellipsePerimeter(semiMajor, semiMinor);
}

/**
 * How far a learner's drawing is from the reference, in mm.
 * LENGTH: the worse endpoint, pairing endpoints whichever way is closer.
 * ELLIPSE: the worst of centre offset and semi-axis differences.
 */
export function placementErrorMm(tool: MeasurementTool, learner: Point[], reference: Point[], calibration: Calibration): number {
  if (tool === 'LENGTH') {
    const [a, b] = learner.map((point) => toMm(point, calibration)) as [Point, Point];
    const [r1, r2] = reference.map((point) => toMm(point, calibration)) as [Point, Point];
    const straight = Math.max(distance(a, r1), distance(b, r2));
    const swapped = Math.max(distance(a, r2), distance(b, r1));
    return Math.min(straight, swapped);
  }
  const mine = ellipseMm(learner, calibration);
  const ref = ellipseMm(reference, calibration);
  return Math.max(
    distance(mine.center, ref.center),
    Math.abs(mine.semiMajor - ref.semiMajor),
    Math.abs(mine.semiMinor - ref.semiMinor),
  );
}

/** SCOORD ELLIPSE points for an ellipse given in pixels (angle in radians). */
export function ellipseCoords(center: Point, semiMajor: number, semiMinor: number, angle: number): Point[] {
  const [cx, cy] = center;
  const ux = Math.cos(angle);
  const uy = Math.sin(angle);
  return [
    [cx - ux * semiMajor, cy - uy * semiMajor],
    [cx + ux * semiMajor, cy + uy * semiMajor],
    [cx + uy * semiMinor, cy - ux * semiMinor],
    [cx - uy * semiMinor, cy + ux * semiMinor],
  ];
}

/** Centre, semi-axes (px) and angle of a SCOORD ELLIPSE, for drawing. */
export function ellipseShape(coords: Point[]): { center: Point; semiMajor: number; semiMinor: number; angle: number } {
  const [m1, m2, n1, n2] = coords as [Point, Point, Point, Point];
  return {
    center: midpoint(m1, m2),
    semiMajor: distance(m1, m2) / 2,
    semiMinor: distance(n1, n2) / 2,
    angle: Math.atan2(m2[1] - m1[1], m2[0] - m1[0]),
  };
}

/** A BOX (two opposite corners) as a 4-vertex polygon; other tools unchanged. */
export function regionPolygon(tool: 'BOX' | 'POLYGON', coords: Point[]): Point[] {
  if (tool === 'POLYGON') return coords;
  const [[x1, y1], [x2, y2]] = coords as [Point, Point];
  return [
    [x1, y1],
    [x2, y1],
    [x2, y2],
    [x1, y2],
  ];
}

function inside([x, y]: Point, polygon: Point[]): boolean {
  let hit = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i]!;
    const [xj, yj] = polygon[j]!;
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
}

/**
 * Intersection-over-union of two polygons, by sampling a grid over their
 * combined bounding box (≤ `cells` per side). Accurate to well under 1% at the
 * default resolution, and robust for any (even self-intersecting) outline.
 */
export function polygonIoU(a: Point[], b: Point[], cells = 400): number {
  const all = [...a, ...b];
  const minX = Math.min(...all.map((p) => p[0]));
  const maxX = Math.max(...all.map((p) => p[0]));
  const minY = Math.min(...all.map((p) => p[1]));
  const maxY = Math.max(...all.map((p) => p[1]));
  const step = Math.max(maxX - minX, maxY - minY) / cells;
  if (!(step > 0)) return 0;
  let both = 0;
  let either = 0;
  for (let y = minY + step / 2; y < maxY; y += step) {
    for (let x = minX + step / 2; x < maxX; x += step) {
      const inA = inside([x, y], a);
      const inB = inside([x, y], b);
      if (inA || inB) either++;
      if (inA && inB) both++;
    }
  }
  return either === 0 ? 0 : both / either;
}

/** Distance between two points in mm (calibrated) and as % of the image width. */
export function pointDistance(a: Point, b: Point, imageWidth: number, calibration: Calibration | null): { mm: number | null; percent: number } {
  const px = distance(a, b);
  return {
    mm: calibration ? distance(toMm(a, calibration), toMm(b, calibration)) : null,
    percent: (px / imageWidth) * 100,
  };
}
