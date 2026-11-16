'use client';

import { ellipseCoords, ellipseShape, regionPolygon } from '@obgyn/dicom';
import { type AnnotationTool, type Point } from '@obgyn/types';
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { loadCornerstone, type Cornerstone } from './cornerstone';

export type ViewerMode = 'pan' | 'zoom' | 'contrast' | AnnotationTool;

export interface OverlayShape {
  id: string;
  tool: AnnotationTool;
  coords: Point[];
  label: string;
  tone: 'mine' | 'reference';
  editable: boolean;
}

interface Props {
  /** Signed, short-lived URL of the DICOM file. */
  imageUrl: string;
  frames: number;
  /** 1-based. */
  frame: number;
  onFrameChange: (frame: number) => void;
  mode: ViewerMode;
  shapes: OverlayShape[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onCreate?: (tool: AnnotationTool, coords: Point[]) => void;
  onUpdate?: (id: string, coords: Point[]) => void;
  onDelete?: (id: string) => void;
  /** Increment to reset zoom/pan/contrast. */
  resetSignal: number;
  ariaLabel: string;
  loadingText: string;
  errorText: string;
}

type Engine = {
  cs: Cornerstone;
  engine: InstanceType<Cornerstone['core']['RenderingEngine']>;
  viewport: import('@cornerstonejs/core').Types.IStackViewport;
  groupId: string;
};

type Drag =
  | { kind: 'create'; tool: 'LENGTH' | 'ELLIPSE' | 'BOX'; start: Point; end: Point }
  | { kind: 'handle'; id: string; handle: number; original: Point[] }
  | { kind: 'move'; id: string; from: Point; original: Point[] };

const MIN_DRAW_PX = 4;
/** Close an outline by clicking within this many screen pixels of its first point. */
const CLOSE_PX = 10;
/** Learner blue, faculty answer green (as in the course plan); selection orange. */
const COLORS = { mine: '#3b82f6', reference: '#22c55e', selected: '#f97316' };

const DRAG_TOOLS = new Set<ViewerMode>(['LENGTH', 'ELLIPSE', 'BOX']);
const isAnnotating = (mode: ViewerMode): mode is AnnotationTool =>
  mode === 'POINT' || mode === 'BOX' || mode === 'POLYGON' || mode === 'LENGTH' || mode === 'ELLIPSE';

/**
 * A DICOM stack viewport (Cornerstone3D) with our own annotation layer —
 * landmark pins, boxes, outlines, calipers and rotatable ellipses in image
 * pixel coordinates — so values match the server's grading exactly.
 * Pan/zoom/contrast are Cornerstone tools; middle-drag pans, right-drag zooms,
 * the wheel zooms (or scrolls frames).
 */
export function DicomViewer(props: Props) {
  const { imageUrl, frames, frame, mode, shapes, selectedId } = props;
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const element = useRef<HTMLDivElement>(null);
  const svg = useRef<SVGSVGElement>(null);
  const engine = useRef<Engine | null>(null);
  const [ready, setReady] = useState(false);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [, setTick] = useState(0);
  const [drag, setDrag] = useState<Drag | null>(null);
  /** Outline being drawn: clicked vertices and the pointer position. */
  const [outline, setOutline] = useState<{ points: Point[]; hover: Point | null } | null>(null);
  const latest = useRef(props);
  latest.current = props;

  const imageIds = useMemo(
    () =>
      Array.from({ length: Math.max(1, frames) }, (_, i) =>
        frames > 1 ? `wadouri:${imageUrl}&frame=${i + 1}` : `wadouri:${imageUrl}`,
      ),
    [imageUrl, frames],
  );

  // Rendering engine + tool group, once per mount.
  useEffect(() => {
    let disposed = false;
    const ids = { engine: `re${uid}`, viewport: `vp${uid}`, group: `tg${uid}` };
    loadCornerstone()
      .then((cs) => {
        if (disposed || !element.current) return;
        const { core, tools } = cs;
        const renderingEngine = new core.RenderingEngine(ids.engine);
        renderingEngine.enableElement({ viewportId: ids.viewport, element: element.current, type: core.Enums.ViewportType.STACK });
        const group = tools.ToolGroupManager.createToolGroup(ids.group)!;
        for (const tool of [tools.PanTool, tools.ZoomTool, tools.WindowLevelTool, tools.StackScrollTool]) group.addTool(tool.toolName);
        group.addViewport(ids.viewport, ids.engine);
        engine.current = {
          cs,
          engine: renderingEngine,
          viewport: renderingEngine.getViewport(ids.viewport) as import('@cornerstonejs/core').Types.IStackViewport,
          groupId: ids.group,
        };
        const rerender = () => setTick((t) => t + 1);
        element.current.addEventListener(core.Enums.Events.IMAGE_RENDERED, rerender);
        element.current.addEventListener(core.Enums.Events.STACK_NEW_IMAGE, () => {
          const index = engine.current?.viewport.getCurrentImageIdIndex() ?? 0;
          if (index + 1 !== latest.current.frame) latest.current.onFrameChange(index + 1);
        });
        setReady(true);
      })
      .catch(() => !disposed && setStatus('error'));
    return () => {
      disposed = true;
      const current = engine.current;
      engine.current = null;
      if (current) {
        current.cs.tools.ToolGroupManager.destroyToolGroup(current.groupId);
        current.engine.destroy();
      }
    };
  }, [uid]);

  // Load the image (all frames as a stack).
  useEffect(() => {
    const current = engine.current;
    if (!ready || !current) return;
    let cancelled = false;
    setStatus('loading');
    current.viewport
      .setStack(imageIds, Math.min(Math.max(latest.current.frame - 1, 0), imageIds.length - 1))
      .then(() => {
        if (cancelled) return;
        current.viewport.render();
        setStatus('ready');
      })
      .catch(() => !cancelled && setStatus('error'));
    return () => {
      cancelled = true;
    };
  }, [ready, imageIds]);

  useEffect(() => {
    const current = engine.current;
    if (!current || status !== 'ready') return;
    if (current.viewport.getCurrentImageIdIndex() !== frame - 1) void current.viewport.setImageIdIndex(frame - 1);
  }, [frame, status]);

  // Mouse bindings for the active mode. Annotating modes leave the primary button to our layer.
  useEffect(() => {
    const current = engine.current;
    if (!ready || !current) return;
    const { tools } = current.cs;
    const group = tools.ToolGroupManager.getToolGroup(current.groupId);
    if (!group) return;
    const { MouseBindings } = tools.Enums;
    const primary = mode === 'pan' ? tools.PanTool : mode === 'zoom' ? tools.ZoomTool : mode === 'contrast' ? tools.WindowLevelTool : null;
    group.setToolActive(tools.PanTool.toolName, {
      bindings: [{ mouseButton: MouseBindings.Auxiliary }, ...(primary === tools.PanTool ? [{ mouseButton: MouseBindings.Primary }] : [])],
    });
    group.setToolActive(tools.ZoomTool.toolName, {
      bindings: [{ mouseButton: MouseBindings.Secondary }, ...(primary === tools.ZoomTool ? [{ mouseButton: MouseBindings.Primary }] : [])],
    });
    if (primary === tools.WindowLevelTool) {
      group.setToolActive(tools.WindowLevelTool.toolName, { bindings: [{ mouseButton: MouseBindings.Primary }] });
    } else {
      group.setToolPassive(tools.WindowLevelTool.toolName);
    }
    group.setToolActive(tools.StackScrollTool.toolName, { bindings: [{ mouseButton: MouseBindings.Wheel }] });
  }, [ready, mode]);

  // Switching tools abandons an unfinished outline.
  useEffect(() => setOutline(null), [mode]);

  useEffect(() => {
    const current = engine.current;
    if (!current || status !== 'ready' || props.resetSignal === 0) return;
    current.viewport.resetCamera();
    current.viewport.resetProperties();
    current.viewport.render();
  }, [props.resetSignal, status]);

  // ---- Coordinate transforms (image pixels ↔ canvas CSS pixels) -------------------

  const toCanvas = (point: Point): Point | null => {
    const current = engine.current;
    const imageId = current?.viewport.getCurrentImageId();
    if (!current || !imageId) return null;
    const world = current.cs.core.utilities.imageToWorldCoords(imageId, point);
    if (!world) return null;
    const [x, y] = current.viewport.worldToCanvas(world);
    return [x, y];
  };

  const toImage = (event: { clientX: number; clientY: number }): Point | null => {
    const current = engine.current;
    const imageId = current?.viewport.getCurrentImageId();
    const rect = svg.current?.getBoundingClientRect();
    if (!current || !imageId || !rect) return null;
    const world = current.viewport.canvasToWorld([event.clientX - rect.left, event.clientY - rect.top]);
    const [x, y] = current.cs.core.utilities.worldToImageCoords(imageId, world) ?? [];
    return x === undefined || y === undefined ? null : [x, y];
  };

  const screenDistance = (a: Point, b: Point) => {
    const [ca, cb] = [toCanvas(a), toCanvas(b)];
    return ca && cb ? Math.hypot(ca[0] - cb[0], ca[1] - cb[1]) : Infinity;
  };

  // ---- Editing -------------------------------------------------------------------

  const created = (d: Extract<Drag, { kind: 'create' }>, at: Point): Point[] => {
    if (d.tool === 'LENGTH' || d.tool === 'BOX') return [d.start, at];
    const semiMajor = Math.hypot(at[0] - d.start[0], at[1] - d.start[1]) / 2;
    const center: Point = [(d.start[0] + at[0]) / 2, (d.start[1] + at[1]) / 2];
    return ellipseCoords(center, semiMajor, semiMajor * 0.8, Math.atan2(at[1] - d.start[1], at[0] - d.start[0]));
  };

  const edited = (d: Exclude<Drag, { kind: 'create' }>, at: Point): Point[] => {
    if (d.kind === 'move') {
      const dx = at[0] - d.from[0];
      const dy = at[1] - d.from[1];
      return d.original.map(([x, y]) => [x + dx, y + dy]);
    }
    const shape = shapes.find((s) => s.id === d.id);
    if (!shape) return d.original;
    if (shape.tool === 'BOX') {
      // Handles are the four corners; each moves its own x and y.
      const [[x1, y1], [x2, y2]] = d.original as [Point, Point];
      const corners: [number, number, number, number][] = [
        [at[0], at[1], x2, y2],
        [x1, at[1], at[0], y2],
        [x1, y1, at[0], at[1]],
        [at[0], y1, x2, at[1]],
      ];
      const [a, b, c, e] = corners[d.handle]!;
      return [
        [a, b],
        [c, e],
      ];
    }
    if (shape.tool !== 'ELLIPSE') return d.original.map((p, i) => (i === d.handle ? at : p));
    const { center, semiMajor, semiMinor, angle } = ellipseShape(d.original);
    if (d.handle <= 1) {
      // Dragging one end of the major axis; the other end stays put.
      const fixed = d.original[d.handle === 0 ? 1 : 0]!;
      const [from, to] = d.handle === 1 ? [fixed, at] : [at, fixed];
      const mid: Point = [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2];
      return ellipseCoords(mid, Math.hypot(to[0] - from[0], to[1] - from[1]) / 2, semiMinor, Math.atan2(to[1] - from[1], to[0] - from[0]));
    }
    // Minor axis: its length follows the distance from the centre, perpendicular to the major axis.
    const perpendicular = Math.abs(-(at[0] - center[0]) * Math.sin(angle) + (at[1] - center[1]) * Math.cos(angle));
    return ellipseCoords(center, semiMajor, Math.max(perpendicular, 1), angle);
  };

  const finishOutline = (points: Point[]) => {
    setOutline(null);
    if (points.length >= 3) props.onCreate?.('POLYGON', points);
  };

  const onPointerDown = (event: PointerEvent<SVGSVGElement>) => {
    if (event.button !== 0 || !isAnnotating(mode) || !props.onCreate) return;
    const at = toImage(event);
    if (!at) return;
    props.onSelect(null);
    if (mode === 'POINT') {
      props.onCreate('POINT', [at]);
      return;
    }
    if (mode === 'POLYGON') {
      const points = outline?.points ?? [];
      if (points.length >= 3 && screenDistance(points[0]!, at) <= CLOSE_PX) return finishOutline(points);
      setOutline({ points: [...points, at], hover: at });
      return;
    }
    if (DRAG_TOOLS.has(mode)) {
      event.currentTarget.setPointerCapture(event.pointerId);
      setDrag({ kind: 'create', tool: mode as 'LENGTH' | 'ELLIPSE' | 'BOX', start: at, end: at });
    }
  };

  const startHandleDrag = (event: PointerEvent, shape: OverlayShape, handle: number | 'move') => {
    if (event.button !== 0 || !shape.editable || outline) return;
    event.stopPropagation();
    const at = toImage(event);
    if (!at) return;
    svg.current?.setPointerCapture(event.pointerId);
    props.onSelect(shape.id);
    setDrag(handle === 'move' ? { kind: 'move', id: shape.id, from: at, original: shape.coords } : { kind: 'handle', id: shape.id, handle, original: shape.coords });
  };

  const onPointerMove = (event: PointerEvent<SVGSVGElement>) => {
    if (outline) {
      const at = toImage(event);
      if (at) setOutline({ ...outline, hover: at });
      return;
    }
    if (!drag) return;
    const at = toImage(event);
    if (!at) return;
    if (drag.kind === 'create') setDrag({ ...drag, end: at });
    else props.onUpdate?.(drag.id, edited(drag, at));
  };

  const onPointerUp = () => {
    if (drag?.kind === 'create' && screenDistance(drag.start, drag.end) >= MIN_DRAW_PX) {
      props.onCreate?.(drag.tool, created(drag, drag.end));
    }
    setDrag(null);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (outline && event.key === 'Enter') {
      event.preventDefault();
      finishOutline(outline.points);
    } else if ((event.key === 'Delete' || event.key === 'Backspace') && selectedId) {
      const shape = shapes.find((s) => s.id === selectedId);
      if (shape?.editable) {
        event.preventDefault();
        props.onDelete?.(selectedId);
      }
    } else if (event.key === 'Escape') {
      setDrag(null);
      setOutline(null);
      props.onSelect(null);
    }
  };

  // ---- Drawing ----------------------------------------------------------------------

  const drawn: OverlayShape[] =
    drag?.kind === 'create'
      ? [...shapes, { id: '__new', tool: drag.tool, coords: created(drag, drag.end), label: '', tone: 'mine', editable: false }]
      : shapes;

  /** Bodies are grabbable (to move a shape) only when no drawing tool is active, so drawing inside an outline works. */
  const movable = !isAnnotating(mode);

  const renderShape = (shape: OverlayShape) => {
    const points = shape.coords.map(toCanvas);
    if (points.some((p) => p === null)) return null;
    const p = points as Point[];
    const selected = shape.id === selectedId;
    const color = selected ? COLORS.selected : COLORS[shape.tone];
    const dash = shape.tone === 'reference' ? '6 4' : undefined;
    const fill = shape.tone === 'reference' ? 'rgba(34,197,94,0.12)' : 'rgba(59,130,246,0.14)';
    let body;
    let grab;
    let handles: Point[] = shape.editable ? p : [];
    let labelAt: Point;
    if (shape.tool === 'POINT') {
      const [x, y] = p[0]!;
      body = (
        <>
          <circle cx={x} cy={y} r={7} fill="none" stroke={color} strokeWidth={2} strokeDasharray={dash} />
          <line x1={x - 11} y1={y} x2={x + 11} y2={y} stroke={color} strokeWidth={1.5} />
          <line x1={x} y1={y - 11} x2={x} y2={y + 11} stroke={color} strokeWidth={1.5} />
        </>
      );
      handles = [];
      // A pin is moved by dragging it, in any mode (it is tiny).
      grab = shape.editable ? <circle cx={x} cy={y} r={9} fill="transparent" pointerEvents="all" /> : null;
      labelAt = [x + 10, y - 10];
    } else if (shape.tool === 'BOX' || shape.tool === 'POLYGON') {
      const polygon = shape.tool === 'BOX' ? (regionPolygon('BOX', shape.coords).map(toCanvas) as Point[]) : p;
      if (shape.tool === 'BOX' && shape.editable) handles = polygon;
      const path = polygon.map(([x, y]) => `${x},${y}`).join(' ');
      body = <polygon points={path} fill={fill} stroke={color} strokeWidth={2} strokeDasharray={dash} />;
      grab = shape.editable && movable ? <polygon points={path} fill="transparent" pointerEvents="all" /> : null;
      const top = polygon.reduce((a, b) => (b[1] < a[1] ? b : a));
      labelAt = [top[0] + 6, top[1] - 8];
    } else if (shape.tool === 'LENGTH') {
      body = <line x1={p[0]![0]} y1={p[0]![1]} x2={p[1]![0]} y2={p[1]![1]} stroke={color} strokeWidth={2} strokeDasharray={dash} />;
      grab = shape.editable && movable ? <line x1={p[0]![0]} y1={p[0]![1]} x2={p[1]![0]} y2={p[1]![1]} stroke="transparent" strokeWidth={12} pointerEvents="stroke" /> : null;
      labelAt = [Math.max(p[0]![0], p[1]![0]) + 6, Math.min(p[0]![1], p[1]![1]) - 6];
    } else {
      const shapeInfo = ellipseShape(p);
      const center = shapeInfo.center;
      body = (
        <ellipse
          cx={center[0]}
          cy={center[1]}
          rx={shapeInfo.semiMajor}
          ry={shapeInfo.semiMinor}
          transform={`rotate(${(shapeInfo.angle * 180) / Math.PI} ${center[0]} ${center[1]})`}
          fill="none"
          stroke={color}
          strokeWidth={2}
          strokeDasharray={dash}
        />
      );
      grab = shape.editable ? <circle cx={center[0]} cy={center[1]} r={7} fill="transparent" stroke={color} strokeWidth={1} pointerEvents={movable ? 'all' : 'none'} /> : null;
      labelAt = [center[0] + shapeInfo.semiMajor * 0.7, center[1] - Math.max(shapeInfo.semiMajor, shapeInfo.semiMinor) - 6];
    }
    return (
      <g key={shape.id} onPointerDown={(e) => shape.editable && startHandleDrag(e, shape, 'move')} style={{ cursor: shape.editable && movable ? 'move' : undefined }}>
        {grab}
        <g pointerEvents="none">{body}</g>
        {handles.map(([x, y], i) => (
          <circle
            key={i}
            cx={x}
            cy={y}
            r={selected ? 6 : 4.5}
            fill={color}
            stroke="#000"
            strokeWidth={1}
            style={{ cursor: 'crosshair' }}
            pointerEvents="all"
            onPointerDown={(e) => startHandleDrag(e, shape, i)}
          />
        ))}
        {shape.label ? (
          <text
            x={labelAt[0]}
            y={labelAt[1] + (shape.tone === 'reference' ? 18 : 0)}
            fill={color}
            fontSize={13}
            fontWeight={600}
            paintOrder="stroke"
            stroke="#000"
            strokeWidth={3}
            pointerEvents="none"
          >
            {shape.label}
          </text>
        ) : null}
      </g>
    );
  };

  const outlinePreview = (() => {
    if (!outline) return null;
    const pts = [...outline.points, ...(outline.hover ? [outline.hover] : [])].map(toCanvas).filter((q): q is Point => q !== null);
    const first = pts[0];
    return (
      <g pointerEvents="none">
        <polyline points={pts.map(([x, y]) => `${x},${y}`).join(' ')} fill="none" stroke={COLORS.mine} strokeWidth={2} strokeDasharray="4 3" />
        {first && outline.points.length >= 3 ? <circle cx={first[0]} cy={first[1]} r={CLOSE_PX} fill="rgba(59,130,246,0.25)" stroke={COLORS.mine} /> : null}
        {pts.slice(0, outline.points.length).map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r={3.5} fill={COLORS.mine} />
        ))}
      </g>
    );
  })();

  const annotating = isAnnotating(mode);
  return (
    <div
      className="relative size-full outline-none"
      tabIndex={0}
      role="application"
      aria-label={props.ariaLabel}
      onKeyDown={onKeyDown}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div ref={element} className="absolute inset-0" />
      <svg
        ref={svg}
        className="absolute inset-0 size-full"
        style={{ pointerEvents: annotating || drag || outline ? 'all' : 'none', cursor: annotating ? 'crosshair' : undefined }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => setDrag(null)}
        onDoubleClick={() => outline && finishOutline(outline.points)}
      >
        {status === 'ready' ? (
          <g style={{ pointerEvents: 'auto' }}>
            {drawn.map(renderShape)}
            {outlinePreview}
          </g>
        ) : null}
      </svg>
      {status !== 'ready' ? (
        <div role="status" className="absolute inset-0 flex items-center justify-center text-sm text-white/80">
          {status === 'error' ? props.errorText : props.loadingText}
        </div>
      ) : null}
    </div>
  );
}
