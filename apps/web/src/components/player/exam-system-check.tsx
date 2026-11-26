'use client';

import { Button } from '@obgyn/ui';
import { Camera, CheckCircle2, Loader2, Mic, Monitor, RefreshCw, ScanFace, Wifi, XCircle, Globe } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { api } from '@/lib/instructor-api';
import { EXAM_CAMERA } from '@/lib/live-camera';
import { MediaPermissionDialog } from './media-permission-dialog';
import { hasSecondScreen, loadProctorModels, webglAvailable, startAiMonitor, type AiStatus, type ProctorModels } from '@/lib/proctor-ai';

export interface ExamMedia {
  stream: MediaStream;
  /** Microphone, for the voice check only (never sent to proctors). */
  audio: MediaStream | null;
  models: ProctorModels | null;
}

type CheckState = 'pending' | 'ok' | 'fail';

/**
 * Before a proctored exam: camera (and, with AI checks, face in frame and microphone),
 * one display, a supported browser and the connection. The exam can start only when
 * all pass. The camera stays on and is handed to the exam.
 */
export function ExamSystemCheck({
  lessonId,
  ai,
  onMedia,
  onReady,
}: {
  lessonId: string;
  ai: boolean;
  onMedia: (media: ExamMedia | null) => void;
  onReady: (ready: boolean) => void;
}) {
  const t = useTranslations('Exam.check');
  const [media, setMedia] = useState<ExamMedia | null>(null);
  const [busy, setBusy] = useState(false);
  const [cameraError, setCameraError] = useState(false);
  const [micError, setMicError] = useState(false);
  // Popup asking to turn the camera / microphone on (when blocked or switched off).
  const [askPermission, setAskPermission] = useState(false);
  // Why the face check couldn't run (shown in small print so learners can report it).
  const [aiError, setAiError] = useState<string | null>(null);
  const failAi = (reason: string) => {
    console.warn(`Face check failed: ${reason}`);
    setAiError(reason);
  };
  const [status, setStatus] = useState<AiStatus | null>(null);
  const [latency, setLatency] = useState<number | null | 'fail'>(null);
  const [secondScreen, setSecondScreen] = useState(false);
  const video = useRef<HTMLVideoElement>(null);
  const monitorRef = useRef<{ lastError(): string } | null>(null);
  const callbacks = useRef({ onMedia, onReady });
  callbacks.current = { onMedia, onReady };

  // Checked after mounting (the server can't know), so the first render matches the server's.
  const [browserOk, setBrowserOk] = useState<boolean | null>(null);
  useEffect(() => setBrowserOk(!!document.documentElement.requestFullscreen && typeof RTCPeerConnection !== 'undefined'), []);

  /** Runs every check; resolves true when the camera (and, with AI checks, the microphone) work. */
  const run = async (): Promise<boolean> => {
    setBusy(true);
    setCameraError(false);
    setMicError(false);
    setAiError(null);
    setSecondScreen(hasSecondScreen());
    // Connection: one small request to our API.
    const started = performance.now();
    void api('GET', `learn/lessons/${lessonId}`)
      .then(() => setLatency(Math.round(performance.now() - started)))
      .catch(() => setLatency('fail'));
    try {
      let stream = media?.stream ?? null;
      let cameraFailed = false;
      if (!stream || !stream.getVideoTracks().some((track) => track.readyState === 'live')) {
        try {
          stream = await navigator.mediaDevices.getUserMedia(EXAM_CAMERA);
        } catch {
          stream = null;
          cameraFailed = true;
          setCameraError(true);
        }
      }
      let audio = media?.audio?.getAudioTracks().some((track) => track.readyState === 'live') ? media.audio : null;
      let micFailed = false;
      if (ai && !audio) {
        try {
          audio = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true }, video: false });
        } catch {
          micFailed = true;
          setMicError(true);
        }
      }
      if (cameraFailed || micFailed) setAskPermission(true);
      if (!stream) return false;
      let models = media?.models ?? null;
      if (ai) {
        if (!models && !webglAvailable()) {
          // No graphics in this browser: the face check can't run; say how to fix it.
          console.warn('Face check failed: WebGL is not available');
          setAiError('no-webgl');
        } else if (!models) {
          try {
            models = await loadProctorModels();
          } catch (error) {
            failAi(`load: ${error instanceof Error ? error.message : String(error)}`);
          }
        }
      }
      const next = { stream, audio, models };
      setMedia(next);
      callbacks.current.onMedia(next);
      return !micFailed;
    } finally {
      setBusy(false);
    }
  };

  // Show the camera and run the AI checks live while this panel is open.
  useEffect(() => {
    const element = video.current;
    if (!element || !media) return;
    element.srcObject = media.stream;
    // Camera or microphone switched off (or taken by another app) while the check is open.
    const tracks = [...media.stream.getVideoTracks(), ...(media.audio?.getAudioTracks() ?? [])];
    const lost = (event: Event) => {
      const track = event.target as MediaStreamTrack;
      if (track.kind === 'video') setCameraError(true);
      else setMicError(true);
      setAskPermission(true);
    };
    tracks.forEach((track) => track.addEventListener('ended', lost));
    const unlisten = () => tracks.forEach((track) => track.removeEventListener('ended', lost));
    // Some browsers don't autoplay a stream set from script; without frames the check can't run.
    void element.play().catch(() => undefined);
    if (!media.models) return unlisten;
    setStatus(null);
    const monitor = startAiMonitor({
      models: media.models,
      video: element,
      audio: media.audio,
      onStatus: setStatus,
      onError: (error) => {
        const message = error instanceof Error ? error.message : String(error);
        // MediaPipe couldn't get a graphics context: same fix as having no WebGL at all.
        if (/webgl_create_context|kGpuService/i.test(message)) {
          console.warn('Face check failed:', message);
          setAiError('no-webgl');
        } else {
          failAi(`analyse ${media.models?.delegate ?? ''}: ${message}`);
        }
      },
    });
    monitorRef.current = monitor;
    return () => {
      monitor.stop();
      unlisten();
    };
  }, [media]);

  // No result from the face check in time: say so instead of "Starting…" forever.
  const waiting = ai && !!media?.models && !status && !aiError;
  useEffect(() => {
    if (!waiting) return;
    const timer = window.setTimeout(() => {
      const v = video.current;
      failAi(
        `no result in 20 s (video ${v?.videoWidth ?? 0}x${v?.videoHeight ?? 0}, ready ${v?.readyState ?? '-'}, paused ${v?.paused ?? '-'}, time ${v?.currentTime.toFixed(1) ?? '-'}, tab ${document.visibilityState}, last error ${monitorRef.current?.lastError() || 'none'})`,
      );
    }, 20_000);
    return () => window.clearTimeout(timer);
  }, [waiting]);

  const cameraOk = !!media && !cameraError;
  const checks: { key: string; icon: ReactNode; label: string; state: CheckState; detail: string }[] = [
    {
      key: 'camera',
      icon: <Camera aria-hidden className="size-4" />,
      label: t('camera'),
      state: cameraError ? 'fail' : cameraOk ? 'ok' : 'pending',
      detail: cameraError ? t('cameraDenied') : cameraOk ? t('cameraOk') : t('notChecked'),
    },
    ...(ai
      ? [
          {
            key: 'face',
            icon: <ScanFace aria-hidden className="size-4" />,
            label: t('face'),
            state: (aiError ? 'fail' : !status ? 'pending' : status.faces === 1 ? 'ok' : 'fail') as CheckState,
            detail: aiError === 'no-webgl'
              ? t('noWebgl')
              : aiError
              ? `${t('aiFailed')} [${aiError}]`
              : !status
                ? cameraOk ? t('aiLoading') : t('notChecked')
                : status.faces === 0
                  ? t('noFace')
                  : status.faces > 1
                    ? t('manyFaces', { count: status.faces })
                    : status.lookingAway
                      ? t('faceTurned')
                      : t('faceOk'),
          },
          {
            key: 'mic',
            icon: <Mic aria-hidden className="size-4" />,
            label: t('mic'),
            state: (micError ? 'fail' : media?.audio ? 'ok' : 'pending') as CheckState,
            detail: micError ? t('micDenied') : media?.audio ? t('micOk') : t('notChecked'),
          },
        ]
      : []),
    {
      key: 'screen',
      icon: <Monitor aria-hidden className="size-4" />,
      label: t('screen'),
      state: !media ? 'pending' : secondScreen ? 'fail' : 'ok',
      detail: !media ? t('notChecked') : secondScreen ? t('secondScreen') : t('screenOk'),
    },
    {
      key: 'browser',
      icon: <Globe aria-hidden className="size-4" />,
      label: t('browser'),
      state: browserOk === null ? 'pending' : browserOk ? 'ok' : 'fail',
      detail: browserOk === null ? t('notChecked') : browserOk ? t('browserOk') : t('browserBad'),
    },
    {
      key: 'network',
      icon: <Wifi aria-hidden className="size-4" />,
      label: t('network'),
      state: latency === null ? 'pending' : latency === 'fail' || latency > 3000 ? 'fail' : 'ok',
      detail: latency === null ? t('notChecked') : latency === 'fail' ? t('networkFail') : t('networkOk', { ms: latency }),
    },
  ];
  const passed = checks.filter((c) => c.state === 'ok').length;
  const ready = passed === checks.length;
  useEffect(() => callbacks.current.onReady(ready), [ready]);

  return (
    <section aria-labelledby="system-check-title" className="flex flex-col gap-4 rounded-2xl border border-border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 id="system-check-title" className="font-semibold">{t('title')}</h3>
          <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
        </div>
        <span className={`rounded-full px-3 py-1 text-sm font-medium ${ready ? 'bg-green-50 text-green-900 dark:bg-green-900/30 dark:text-green-100' : 'bg-muted'}`} role="status">
          {t('summary', { passed, total: checks.length })}
        </span>
      </div>
      <div className="grid gap-4 md:grid-cols-[minmax(0,280px)_1fr]">
        <div className="relative aspect-[4/3] overflow-hidden rounded-xl bg-black">
          <video ref={video} autoPlay muted playsInline aria-label={t('preview')} className="size-full -scale-x-100 object-cover" />
          {!media ? (
            <span className="absolute inset-0 grid place-items-center p-4 text-center text-sm text-white/80">{t('previewHint')}</span>
          ) : null}
          {ai && media?.audio ? (
            <div className="absolute inset-x-3 bottom-3 flex items-center gap-2 rounded-full bg-black/60 px-3 py-1 text-xs text-white">
              <Mic aria-hidden className="size-3.5" />
              <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/25" aria-hidden>
                <span className="block h-full rounded-full bg-green-400 transition-[width]" style={{ width: `${Math.round((status?.micLevel ?? 0) * 100)}%` }} />
              </span>
              <span>{t('sayHello')}</span>
            </div>
          ) : null}
        </div>
        <ul className="flex flex-col gap-2">
          {checks.map((check) => (
            <li key={check.key} className="flex items-start gap-3 rounded-lg bg-muted/60 px-3 py-2 text-sm">
              <span className="mt-0.5 text-muted-foreground">{check.icon}</span>
              <span className="min-w-0 flex-1">
                <span className="font-medium">{check.label}</span>
                <span className={`block text-xs ${check.state === 'fail' ? 'text-destructive' : 'text-muted-foreground'}`}>{check.detail}</span>
              </span>
              {check.state === 'ok' ? (
                <CheckCircle2 aria-label={t('ok')} className="size-5 text-success" />
              ) : check.state === 'fail' ? (
                <XCircle aria-label={t('failed')} className="size-5 text-destructive" />
              ) : (
                <span className="text-xs text-muted-foreground">—</span>
              )}
            </li>
          ))}
        </ul>
      </div>
      <div>
        <Button variant={media ? 'outline' : 'default'} onClick={() => void run()} disabled={busy}>
          {busy ? <Loader2 aria-hidden className="size-4 animate-spin" /> : media ? <RefreshCw aria-hidden className="size-4" /> : <Camera aria-hidden className="size-4" />}
          {busy ? (ai && !media ? t('loadingModels') : t('checking')) : media ? t('recheck') : t('run')}
        </Button>
      </div>
      <MediaPermissionDialog
        open={askPermission}
        camera={cameraError}
        mic={micError}
        onRetry={async () => {
          const ok = await run();
          if (ok) setAskPermission(false);
          return ok;
        }}
        onClose={() => setAskPermission(false)}
      />
    </section>
  );
}
