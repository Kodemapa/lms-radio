'use client';

import type { FaceLandmarker, ObjectDetector } from '@mediapipe/tasks-vision';

/**
 * AI checks for proctored exams, run entirely in the learner's browser with MediaPipe
 * (no image or sound leaves the device; only the alert, plus a small snapshot as
 * evidence, is sent). Ideas adapted from the open-source @timadey/proctor engine (MIT):
 * face count, head turned away, phone/book in view, voices, and a second screen.
 *
 * The runtime (WebAssembly) is served by /api/proctor-ai/*, the models from
 * /public/proctor-ai/*, so nothing depends on an outside CDN during an exam.
 */

export type AiAlertKind = 'NO_FACE' | 'MULTIPLE_FACES' | 'LOOKING_AWAY' | 'PROHIBITED_OBJECT' | 'VOICE_DETECTED' | 'SECOND_SCREEN';

export interface AiAlert {
  kind: AiAlertKind;
  /** PROHIBITED_OBJECT: "cell phone" | "book". */
  object?: string;
  /** Small JPEG data URL of the camera at that moment (not for SECOND_SCREEN / VOICE_DETECTED). */
  snapshot?: string;
}

/** What the checks see right now (for the pre-exam system check). */
export interface AiStatus {
  faces: number;
  lookingAway: boolean;
  /** 0..1 */
  micLevel: number;
  secondScreen: boolean;
}

const WASM_BASE = '/api/proctor-ai';
const FACE_MODEL = '/proctor-ai/face_landmarker.task';
const OBJECT_MODEL = '/proctor-ai/efficientdet_lite0.tflite';
const OBJECTS = ['cell phone', 'book'];

/** How long a problem must last before it is reported, and how often it may repeat. */
const RULES = {
  NO_FACE: { holdMs: 5000 },
  MULTIPLE_FACES: { holdMs: 1500 },
  LOOKING_AWAY: { holdMs: 6000 },
  PROHIBITED_OBJECT: { holdMs: 1500 },
  VOICE_DETECTED: { holdMs: 2500 },
} as const;
const REPEAT_MS = 30_000;
const FACE_EVERY_MS = 250;
const OBJECT_EVERY_MS = 1000;
const AUDIO_EVERY_MS = 100;
/** Head turned more than this (degrees) counts as looking away. */
const MAX_YAW = 32;
const MAX_PITCH = 25;

export interface ProctorModels {
  face: FaceLandmarker;
  objects: ObjectDetector | null;
  /** GPU (WebGL) or CPU. */
  readonly delegate: 'GPU' | 'CPU';
  /** Throws away and rebuilds the models on the other processor (after a crash inside MediaPipe). */
  recreate(): Promise<void>;
  close(): void;
}

/** Size of the frame the models analyse: fixed, whatever the camera delivers. */
const FRAME_W = 480;
const FRAME_H = 360;

/** MediaPipe's own status lines, e.g. "INFO: Created TensorFlow Lite XNNPACK delegate for CPU." */
const MEDIAPIPE_LOG = /^(INFO|WARNING): |^[IW]\d{4} \d{2}:\d{2}:\d{2}\.\d+ +\d+ \S+\.cc:\d+\]/;

/**
 * MediaPipe's WebAssembly prints routine status lines through console.error (and
 * console.warn), which the Next.js dev overlay shows as errors. Drop only those lines;
 * real errors still go through.
 */
function quietMediaPipeLogs(): void {
  const flag = '__proctorAiQuiet';
  const target = console as Console & { [flag]?: boolean };
  if (target[flag]) return;
  target[flag] = true;
  for (const level of ['error', 'warn', 'info', 'log'] as const) {
    const original = console[level].bind(console);
    console[level] = (...args: unknown[]) => {
      if (typeof args[0] === 'string' && MEDIAPIPE_LOG.test(args[0])) return;
      original(...args);
    };
  }
}

type Vision = typeof import('@mediapipe/tasks-vision');
type Delegate = 'GPU' | 'CPU';

/**
 * One MediaPipe runtime per page, kept on `globalThis` so a code reload in development
 * doesn't load a second copy next to the first (two copies corrupt each other's memory).
 * Same idea as the reference engine's `sharedModels`.
 */
interface Shared {
  runtime?: Promise<{ vision: Vision; files: Awaited<ReturnType<Vision['FilesetResolver']['forVisionTasks']>> }>;
  models?: Promise<ProctorModels>;
}
const shared: Shared = ((globalThis as { __proctorAi?: Shared }).__proctorAi ??= {});

function runtime() {
  shared.runtime ??= (async () => {
    const vision = await import('@mediapipe/tasks-vision');
    return { vision, files: await vision.FilesetResolver.forVisionTasks(WASM_BASE) };
  })();
  shared.runtime.catch(() => {
    shared.runtime = undefined;
  });
  return shared.runtime;
}

/** Loads the models once per page (they're cached by the browser after the first exam). */
export function loadProctorModels(timeoutMs = 90_000): Promise<ProctorModels> {
  quietMediaPipeLogs();
  shared.models ??= withTimeout(loadModels(), timeoutMs);
  shared.models.catch(() => {
    shared.models = undefined;
  });
  return shared.models;
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error('Loading the face check timed out')), ms);
    promise.then(
      (value) => {
        window.clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        window.clearTimeout(timer);
        reject(error instanceof Error ? error : new Error(String(error)));
      },
    );
  });
}

async function createModels(delegate: Delegate): Promise<{ face: FaceLandmarker; objects: ObjectDetector | null }> {
  const { vision, files } = await runtime();
  // One canvas (so one WebGL context) shared by both models. Each model would otherwise
  // make its own, and Chrome allows only ~16 per tab; past that MediaPipe crashes
  // ("memory access out of bounds", "emscripten_webgl_create_context() returned error").
  const canvas = new OffscreenCanvas(1, 1);
  const face = await vision.FaceLandmarker.createFromOptions(files, {
    canvas,
    baseOptions: { modelAssetPath: FACE_MODEL, delegate },
    runningMode: 'VIDEO',
    numFaces: 3,
    minFaceDetectionConfidence: 0.5,
    minFacePresenceConfidence: 0.5,
    outputFacialTransformationMatrixes: true,
  });
  // Object detection is a bonus: the exam still runs if this model fails to load.
  const objects = await vision.ObjectDetector.createFromOptions(files, {
    canvas,
    baseOptions: { modelAssetPath: OBJECT_MODEL, delegate },
    runningMode: 'VIDEO',
    scoreThreshold: 0.5,
    maxResults: 3,
    categoryAllowlist: OBJECTS,
  }).catch(() => null);
  return { face, objects };
}

/**
 * Whether this browser will give the page a WebGL context at all. MediaPipe needs one
 * even on the CPU. Chrome refuses after repeated graphics crashes on a site (until it is
 * restarted) or when "Use graphics acceleration" is off.
 */
export function webglAvailable(): boolean {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') ?? canvas.getContext('webgl');
    if (!gl) return false;
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return true;
  } catch {
    return false;
  }
}

/**
 * True when WebGL runs in software (no usable graphics card, e.g. SwiftShader): there the
 * GPU path silently finds no faces, so the CPU is used instead.
 */
function softwareGraphics(): boolean {
  try {
    const gl = document.createElement('canvas').getContext('webgl');
    if (!gl) return true;
    const info = gl.getExtension('WEBGL_debug_renderer_info');
    const renderer = String(gl.getParameter(info ? info.UNMASKED_RENDERER_WEBGL : gl.RENDERER));
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /swiftshader|llvmpipe|software|basic render/i.test(renderer);
  } catch {
    return true;
  }
}

/**
 * GPU (WebGL) first, like the reference engine: fastest, and the CPU path crashed on
 * some laptops ("memory access out of bounds"). CPU if the GPU can't be used.
 */
async function loadModels(): Promise<ProctorModels> {
  let delegate: Delegate = softwareGraphics() ? 'CPU' : 'GPU';
  const first = await createModels(delegate).catch(() => {
    delegate = 'CPU';
    return createModels('CPU');
  });
  const models: ProctorModels = {
    ...first,
    get delegate() {
      return delegate;
    },
    async recreate() {
      // After a crash, switch to the other kind of processor.
      const nextDelegate: Delegate = delegate === 'GPU' ? 'CPU' : 'GPU';
      // Free the crashed models (and their WebGL context) before making new ones.
      try {
        models.face.close();
        models.objects?.close();
      } catch {
        // a crashed instance may not close cleanly
      }
      const next = await createModels(nextDelegate);
      delegate = nextDelegate;
      models.face = next.face;
      models.objects = next.objects;
    },
    close() {
      models.face.close();
      models.objects?.close();
      shared.models = undefined;
    },
  };
  return models;
}

/** Head rotation (degrees) from MediaPipe's 4×4 column-major face transform. */
export function headPose(matrix: ArrayLike<number>): { yaw: number; pitch: number } {
  const r20 = matrix[2] ?? 0;
  const r21 = matrix[6] ?? 0;
  const r22 = matrix[10] ?? 1;
  const deg = 180 / Math.PI;
  return { yaw: Math.atan2(-r20, Math.hypot(r21, r22)) * deg, pitch: Math.atan2(r21, r22) * deg };
}

/** A small JPEG of the current camera frame (≤ ~60 KB). */
export function snapshotOf(video: HTMLVideoElement): string | undefined {
  if (!video.videoWidth) return undefined;
  const canvas = document.createElement('canvas');
  canvas.width = 320;
  canvas.height = Math.round((320 * video.videoHeight) / video.videoWidth) || 240;
  const context = canvas.getContext('2d');
  if (!context) return undefined;
  context.drawImage(video, 0, 0, canvas.width, canvas.height);
  for (const quality of [0.7, 0.5, 0.3]) {
    const url = canvas.toDataURL('image/jpeg', quality);
    if (url.length < 85_000) return url;
  }
  return undefined;
}

/** `window.screen.isExtended` (Chrome/Edge): true when more than one display is connected. */
export function hasSecondScreen(): boolean {
  return (window.screen as Screen & { isExtended?: boolean }).isExtended === true;
}

/**
 * Watches the camera (and microphone, when given) and calls `onAlert` when a problem
 * lasts long enough. `onStatus` reports what it sees every frame. Call `stop()` to end.
 */
export function startAiMonitor({
  models,
  video,
  audio,
  onAlert,
  onStatus,
  onError,
}: {
  models: ProctorModels;
  video: HTMLVideoElement;
  audio: MediaStream | null;
  onAlert?: (alert: AiAlert) => void;
  onStatus?: (status: AiStatus) => void;
  /** Face analysis keeps failing on this device (called once). */
  onError?: (error: unknown) => void;
}): { stop(): void; lastError(): string } {
  const since: Partial<Record<AiAlertKind, number>> = {};
  const lastSent: Partial<Record<AiAlertKind, number>> = {};
  const status: AiStatus = { faces: 0, lookingAway: false, micLevel: 0, secondScreen: hasSecondScreen() };
  let object: string | null = null;
  let lastVideoTime = -1;
  let stopped = false;
  let failures = 0;
  let reported = false;
  let recovering = false;
  let recovered = false;

  // The models get a fixed-size copy of each frame (letterboxed), not the live <video>:
  // some webcams change size or format between frames, which crashed MediaPipe
  // ("memory access out of bounds") on real laptops.
  const frame = document.createElement('canvas');
  frame.width = FRAME_W;
  frame.height = FRAME_H;
  const frameContext = frame.getContext('2d', { willReadFrequently: true });
  const grab = (): HTMLCanvasElement | null => {
    if (!frameContext || !video.videoWidth || !video.videoHeight) return null;
    const scale = Math.min(FRAME_W / video.videoWidth, FRAME_H / video.videoHeight);
    const w = Math.round(video.videoWidth * scale);
    const h = Math.round(video.videoHeight * scale);
    frameContext.fillStyle = '#000';
    frameContext.fillRect(0, 0, FRAME_W, FRAME_H);
    frameContext.drawImage(video, (FRAME_W - w) / 2, (FRAME_H - h) / 2, w, h);
    return frame;
  };

  let lastError = '';
  const fail = (error: unknown) => {
    failures += 1;
    lastError = `${models.delegate ?? '?'}: ${error instanceof Error ? error.message : String(error)}`;
    // First run of failures: rebuild the models once on the other processor (a crash leaves them unusable).
    if (failures >= 3 && !recovered && !recovering) {
      if (typeof models.recreate !== 'function') {
        reported = true;
        onError?.(error);
        return;
      }
      recovering = true;
      console.warn('Face check crashed; restarting it', error);
      Promise.resolve()
        .then(() => models.recreate())
        .then(() => {
          recovered = true;
          failures = 0;
        })
        .catch((reloadError: unknown) => {
          reported = true;
          onError?.(reloadError);
        })
        .finally(() => {
          recovering = false;
        });
      return;
    }
    // One bad frame is normal; many in a row (after a restart) means it can't run here.
    if (recovered && failures >= 12 && !reported) {
      reported = true;
      console.warn('Face check failed', error);
      onError?.(error);
    }
  };

  const fire = (alert: AiAlert) => {
    const now = Date.now();
    if (now - (lastSent[alert.kind] ?? 0) < REPEAT_MS) return;
    lastSent[alert.kind] = now;
    onAlert?.(alert);
  };

  /** Track a condition; report it once it has held for its rule's time. */
  const hold = (kind: keyof typeof RULES, active: boolean, extra: Omit<AiAlert, 'kind'> = {}) => {
    const now = Date.now();
    if (!active) {
      delete since[kind];
      return;
    }
    since[kind] ??= now;
    if (now - since[kind]! >= RULES[kind].holdMs) {
      fire({ kind, ...extra, ...(kind === 'VOICE_DETECTED' ? {} : { snapshot: snapshotOf(video) }) });
      since[kind] = now; // keep counting from here, so it repeats only after REPEAT_MS
    }
  };

  const faceTimer = window.setInterval(() => {
    if (stopped || recovering || reported || video.readyState < 2 || video.currentTime === lastVideoTime) return;
    lastVideoTime = video.currentTime;
    const image = grab();
    if (!image) return;
    try {
      const result = models.face.detectForVideo(image, performance.now());
      status.faces = result.faceLandmarks.length;
      const matrix = result.facialTransformationMatrixes?.[0]?.data;
      const pose = matrix ? headPose(matrix) : null;
      status.lookingAway = status.faces === 1 && !!pose && (Math.abs(pose.yaw) > MAX_YAW || Math.abs(pose.pitch) > MAX_PITCH);
      failures = 0;
    } catch (error) {
      fail(error);
      return;
    }
    hold('NO_FACE', status.faces === 0);
    hold('MULTIPLE_FACES', status.faces > 1);
    hold('LOOKING_AWAY', status.lookingAway);
    onStatus?.({ ...status });
  }, FACE_EVERY_MS);

  const objectTimer = window.setInterval(() => {
    if (stopped || recovering || reported || !models.objects || video.readyState < 2) return;
    const image = grab();
    if (!image) return;
    try {
      const result = models.objects.detectForVideo(image, performance.now());
      object = result.detections[0]?.categories[0]?.categoryName ?? null;
    } catch {
      object = null;
    }
    hold('PROHIBITED_OBJECT', !!object && OBJECTS.includes(object), object ? { object } : {});
  }, OBJECT_EVERY_MS);

  // Voices: sound well above the room's background level for a few seconds.
  let audioTimer = 0;
  let context: AudioContext | null = null;
  if (audio?.getAudioTracks().length) {
    context = new AudioContext();
    const analyser = context.createAnalyser();
    analyser.fftSize = 1024;
    context.createMediaStreamSource(audio).connect(analyser);
    const samples = new Float32Array(analyser.fftSize);
    let floor = 0.01;
    let loudMs = 0;
    audioTimer = window.setInterval(() => {
      if (stopped) return;
      analyser.getFloatTimeDomainData(samples);
      let sum = 0;
      for (const v of samples) sum += v * v;
      const rms = Math.sqrt(sum / samples.length);
      // Slowly follow the background noise; speech is a clear step above it.
      floor = rms < floor ? floor * 0.9 + rms * 0.1 : floor * 0.995 + rms * 0.005;
      const speaking = rms > Math.max(0.03, floor * 3);
      loudMs = speaking ? loudMs + AUDIO_EVERY_MS : Math.max(0, loudMs - AUDIO_EVERY_MS / 2);
      status.micLevel = Math.min(1, rms * 8);
      hold('VOICE_DETECTED', loudMs >= 1000);
    }, AUDIO_EVERY_MS);
  }

  // Second screen: checked at the start and whenever displays change.
  const screenWithEvents = window.screen as Screen & EventTarget;
  const onScreenChange = () => {
    status.secondScreen = hasSecondScreen();
    if (status.secondScreen) fire({ kind: 'SECOND_SCREEN' });
  };
  screenWithEvents.addEventListener?.('change', onScreenChange);
  if (status.secondScreen) fire({ kind: 'SECOND_SCREEN' });

  return {
    lastError: () => lastError,
    stop() {
      stopped = true;
      window.clearInterval(faceTimer);
      window.clearInterval(objectTimer);
      window.clearInterval(audioTimer);
      screenWithEvents.removeEventListener?.('change', onScreenChange);
      void context?.close().catch(() => undefined);
    },
  };
}
