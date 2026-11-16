'use client';

import { PlaybackSchema, withDrmToken, type DrmPlayback, type Playback } from '@obgyn/types';
import { ProtectedSurface, type ShieldReason } from '@obgyn/ui';
import { useTranslations } from 'next-intl';
import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
  type Ref,
} from 'react';
import { bffFetch } from '@/lib/client-fetch';
import { pickManifest, protectionLevel, shakaDrmConfig, type ProtectionLevel } from '@/lib/drm';
import { PlayerControls, type PlayerMarker } from './player-controls';

const MAX_RECOVERIES = 3;
/** Refresh the DRM grant this long before it expires. */
const REFRESH_LEAD_MS = 60_000;

type Failure = 'generic' | 'processing' | 'unsupported' | 'hardware';

class PlaybackError extends Error {
  constructor(readonly reason: Failure) {
    super(reason);
  }
}

/** Shaka error 6001: no key system satisfied the requested robustness. */
const KEY_SYSTEM_UNAVAILABLE = 6001;
/** Shaka error 7000: load() interrupted (unmount/re-mount); not a failure. */
const LOAD_INTERRUPTED = 7000;
/** Shaka severity 2 = critical. Recoverable errors are retried by Shaka itself. */
const CRITICAL = 2;

interface ShakaErrorLike {
  code?: number;
  severity?: number;
  data?: unknown[];
}

/** Lets a parent seek/play, e.g. "rewatch" from an in-video question. */
export interface PlayerApi {
  seek: (sec: number) => void;
  play: () => void;
  pause: () => void;
  currentTime: () => number;
}

/**
 * Plays a protected video.
 * - DRM: encrypted DASH/HLS through Shaka Player. Manifest, segment and licence
 *   URLs carry a ≤5-minute session grant that is swapped for a fresh one
 *   before it expires, without interrupting playback.
 * - Progressive (development / DRM off): a ≤5-minute URL; when it expires
 *   mid-playback we fetch a fresh one and resume at the same position.
 * The content is blanked (and playback paused) when a capture looks likely.
 */
export function ProtectedPlayer({
  assetId,
  title,
  startAt = 0,
  onProgress,
  lockAt = null,
  onLockReached,
  overlay,
  markers = [],
  apiRef,
  onTimeChange,
  onMarkerSelect,
}: {
  assetId: string;
  title: string;
  /** Resume position in seconds. */
  startAt?: number;
  /** Called while playing (about every 15 s), on pause and at the end. */
  onProgress?: (positionSec: number, durationSec: number, ended: boolean) => void;
  /**
   * In-video questions: playback can't go past this second. When it's reached
   * the video pauses and onLockReached fires; raising/clearing lockAt resumes.
   */
  lockAt?: number | null;
  onLockReached?: () => void;
  /** Rendered over the video (and kept visible in fullscreen). */
  overlay?: ReactNode;
  /** In-video questions, shown on the timeline. */
  markers?: PlayerMarker[];
  apiRef?: Ref<PlayerApi>;
  /** Current playback time, for authoring tools. */
  onTimeChange?: (sec: number) => void;
  /** Clicking a timeline marker (authoring: edit that question). */
  onMarkerSelect?: (atSec: number) => void;
}) {
  const t = useTranslations('Learn');
  const videoRef = useRef<HTMLVideoElement>(null);
  const recoveries = useRef(0);
  const frame = useRef<HTMLDivElement>(null);
  useImperativeHandle(apiRef, () => ({
    seek: (sec) => {
      const v = videoRef.current;
      if (v) v.currentTime = Math.max(0, Math.min(sec, lockAt ?? v.duration));
    },
    play: () => void videoRef.current?.play().catch(() => undefined),
    pause: () => videoRef.current?.pause(),
    currentTime: () => videoRef.current?.currentTime ?? 0,
  }));
  const pausedByLock = useRef(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [state, setState] = useState({ current: 0, duration: 0, playing: false, muted: false, volume: 1, rate: 1 });
  const sync = () => {
    const v = videoRef.current;
    if (!v) return;
    onTimeChange?.(v.currentTime);
    setState({
      current: v.currentTime,
      duration: Number.isFinite(v.duration) ? v.duration : 0,
      playing: !v.paused,
      muted: v.muted,
      volume: v.volume,
      rate: v.playbackRate,
    });
  };
  const toggleFullscreen = () => (fullscreen ? document.exitFullscreen() : frame.current?.requestFullscreen());

  /** Space/K play-pause, ←/→ ±5 s (never past the lock), M mute, F fullscreen. */
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const v = videoRef.current;
    const tag = (event.target as HTMLElement).tagName;
    if (!v || overlay || tag === 'SELECT' || tag === 'BUTTON' || (tag === 'INPUT' && event.key === ' ')) return;
    const limit = lockAt ?? v.duration;
    const key = event.key.toLowerCase();
    if (key === ' ' || key === 'k') {
      if (v.paused) void v.play().catch(() => undefined);
      else v.pause();
    } else if (key === 'arrowright' && tag !== 'INPUT') v.currentTime = Math.min(v.currentTime + 5, limit);
    else if (key === 'arrowleft' && tag !== 'INPUT') v.currentTime = Math.max(v.currentTime - 5, 0);
    else if (key === 'm') v.muted = !v.muted;
    else if (key === 'f') void toggleFullscreen();
    else return;
    event.preventDefault();
  };

  useEffect(() => {
    const onChange = () => setFullscreen(document.fullscreenElement === frame.current);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  // Once the lock moves past where we paused, carry on playing.
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !pausedByLock.current) return;
    if (lockAt === null || lockAt > video.currentTime + 0.5) {
      pausedByLock.current = false;
      void video.play().catch(() => undefined);
    }
  }, [lockAt]);

  const enforceLock = (video: HTMLVideoElement) => {
    if (lockAt === null) return;
    if (video.currentTime >= lockAt) {
      if (!video.paused) {
        pausedByLock.current = true;
        video.pause();
      }
      if (video.currentTime > lockAt + 0.25) video.currentTime = lockAt;
      onLockReached?.();
    }
  };
  const lastReport = useRef(0);
  const resumed = useRef(false);
  const report = (ended = false) => {
    const video = videoRef.current;
    if (!video || !onProgress || !Number.isFinite(video.duration)) return;
    lastReport.current = Date.now();
    onProgress(Math.floor(video.currentTime), Math.floor(video.duration), ended);
  };
  const [media, setMedia] = useState<Playback | null>(null);
  const [failure, setFailure] = useState<Failure | null>(null);
  const [level, setLevel] = useState<ProtectionLevel | null>(null);
  /** Shaka error code of the last fatal error, shown in development to aid diagnosis. */
  const [errorCode, setErrorCode] = useState<number | null>(null);
  /** The freshest DRM grant; every Shaka request is rewritten to use it. */
  const token = useRef('');

  const load = useCallback(async () => {
    const res = await bffFetch(`/api/proxy/media/${assetId}/playback`);
    if (res.status === 409) throw new PlaybackError('processing');
    if (!res.ok) throw new Error(`playback ${res.status}`);
    return PlaybackSchema.parse(await res.json());
  }, [assetId]);

  useEffect(() => {
    let cancelled = false;
    load()
      .then((next) => {
        if (cancelled) return;
        if (next.kind === 'drm') token.current = next.token;
        setMedia(next);
      })
      .catch((error: unknown) => !cancelled && setFailure(error instanceof PlaybackError ? error.reason : 'generic'));
    return () => {
      cancelled = true;
    };
  }, [load]);

  const drm = media?.kind === 'drm' ? media : null;
  const drmSession = useRef<DrmPlayback | null>(null);
  drmSession.current = drm;
  const isDrm = drm !== null;

  // Start Shaka once per asset. Grant refreshes only update `token`.
  useEffect(() => {
    const video = videoRef.current;
    const session = drmSession.current;
    if (!isDrm || !video || !session) return;
    let cancelled = false;
    let player: { destroy(): Promise<void> } | null = null;
    void (async () => {
      const { default: shaka } = await import('shaka-player/dist/shaka-player.compiled');
      shaka.polyfill.installAll();
      if (!shaka.Player.isBrowserSupported()) throw new PlaybackError('unsupported');
      const instance = new shaka.Player();
      player = instance;
      if (cancelled) return;
      await instance.attach(video);
      instance.getNetworkingEngine()?.registerRequestFilter((_type, request) => {
        request.uris = request.uris.map((uri) => withDrmToken(uri, token.current));
      });
      instance.configure({
        drm: shakaDrmConfig(session),
        streaming: { bufferingGoal: 30, rebufferingGoal: 2 },
      } as unknown as Parameters<typeof instance.configure>[0]);
      instance.addEventListener('error', (event) => {
        const detail = (event as unknown as { detail?: ShakaErrorLike }).detail ?? {};
        console.warn('[player] Shaka error', detail.code, detail.severity, detail.data);
        if (cancelled || detail.severity !== CRITICAL) return;
        setErrorCode(detail.code ?? null);
        setFailure(detail.code === KEY_SYSTEM_UNAVAILABLE ? (session.hardwareRequired ? 'hardware' : 'unsupported') : 'generic');
      });
      try {
        await instance.load(await pickManifest(session));
      } catch (error) {
        const code = (error as { code?: number }).code;
        if (code === KEY_SYSTEM_UNAVAILABLE) throw new PlaybackError(session.hardwareRequired ? 'hardware' : 'unsupported');
        throw error;
      }
      const info = instance.drmInfo();
      const negotiated = protectionLevel(info?.keySystem ?? '', info?.videoRobustness ?? '');
      if (session.hardwareRequired && !negotiated.hardware) throw new PlaybackError('hardware');
      if (cancelled) return;
      setLevel(negotiated);
      if (process.env.NODE_ENV !== 'production') {
        console.info(
          `[player] DRM ${session.provider} · ${negotiated.keySystem} · ${negotiated.hardware ? 'hardware (captures blacked out)' : 'software (capture not blocked)'}`,
        );
      }
    })().catch((error: unknown) => {
      const code = (error as ShakaErrorLike).code;
      if (cancelled || code === LOAD_INTERRUPTED) return;
      console.warn('[player] DRM playback failed', error);
      setErrorCode(typeof code === 'number' ? code : null);
      setFailure(error instanceof PlaybackError ? error.reason : 'generic');
    });
    return () => {
      cancelled = true;
      void player?.destroy();
    };
  }, [isDrm, assetId]);

  // Swap in a fresh grant shortly before the current one expires.
  const expiresAt = failure ? undefined : drm?.expiresAt;
  useEffect(() => {
    if (!expiresAt) return;
    let cancelled = false;
    const wait = Math.max(10_000, new Date(expiresAt).getTime() - Date.now() - REFRESH_LEAD_MS);
    const timer = window.setTimeout(async () => {
      for (let attempt = 0; attempt < 3 && !cancelled; attempt++) {
        try {
          const next = await load();
          if (cancelled || next.kind !== 'drm') return;
          token.current = next.token;
          setMedia(next);
          return;
        } catch {
          await new Promise((resolve) => window.setTimeout(resolve, 10_000));
        }
      }
      if (!cancelled) setFailure('generic');
    }, wait);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [expiresAt, load]);

  /** Pause while the capture shield is up. */
  const onShield = (reason: ShieldReason | null) => {
    if (reason) videoRef.current?.pause();
  };

  const recover = async () => {
    const video = videoRef.current;
    if (media?.kind !== 'progressive') return;
    if (!video || recoveries.current >= MAX_RECOVERIES) return setFailure('generic');
    recoveries.current += 1;
    const resumeAt = video.currentTime;
    const wasPlaying = !video.paused;
    try {
      const next = await load();
      setMedia(next);
      video.addEventListener(
        'loadedmetadata',
        () => {
          video.currentTime = resumeAt;
          if (wasPlaying) void video.play();
        },
        { once: true },
      );
    } catch {
      setFailure('generic');
    }
  };

  if (failure) {
    const message = {
      generic: t('mediaError'),
      processing: t('mediaProcessing'),
      unsupported: t('drmUnsupported'),
      hardware: t('drmHardware'),
    }[failure];
    return (
      <p role="alert" className="rounded-lg border border-border p-8 text-center text-destructive">
        {message}
        {process.env.NODE_ENV !== 'production' && errorCode !== null ? (
          <span className="mt-2 block text-xs text-muted-foreground">Shaka error {errorCode}</span>
        ) : null}
      </p>
    );
  }

  if (!media) {
    return (
      <div
        role="status"
        className="flex aspect-video items-center justify-center rounded-lg bg-muted text-muted-foreground"
      >
        {t('loadingMedia')}
      </div>
    );
  }

  return (
    <div
      ref={frame}
      onKeyDown={onKeyDown}
      data-drm={level ? `${level.keySystem}:${level.hardware ? 'hardware' : 'software'}` : undefined}
      className={`relative ${fullscreen ? 'bg-black' : ''}`}>
    <ProtectedSurface
      className={`rounded-lg bg-black ${fullscreen ? 'size-full rounded-none' : 'aspect-video'}`}
      watermarkLines={[media.watermark.displayName, `u:${media.watermark.userRef} s:${media.watermark.sessionRef}`]}
      onShieldChange={onShield}
      shieldMessages={{ inactive: t('shieldInactive'), capture: t('shieldCapture'), print: t('shieldPrint') }}
    >
      <video
        ref={videoRef}
        key={media.kind === 'progressive' ? media.url : `drm:${assetId}`}
        src={media.kind === 'progressive' ? media.url : undefined}
        title={title}
        className="size-full cursor-pointer"
        onClick={(event) => (event.currentTarget.paused ? void event.currentTarget.play().catch(() => undefined) : event.currentTarget.pause())}
        playsInline
        preload="metadata"
        controlsList="nodownload noremoteplayback nofullscreen"
        disablePictureInPicture
        disableRemotePlayback
        onLoadedMetadata={(event) => {
          if (!resumed.current && startAt > 5 && startAt < event.currentTarget.duration - 5) {
            event.currentTarget.currentTime = startAt;
          }
          resumed.current = true;
          sync();
        }}
        onPlay={sync}
        onDurationChange={sync}
        onVolumeChange={sync}
        onRateChange={sync}
        onPlaying={() => {
          recoveries.current = 0;
        }}
        onTimeUpdate={(event) => {
          enforceLock(event.currentTarget);
          sync();
          if (Date.now() - lastReport.current > 15_000) report();
        }}
        onSeeking={(event) => {
          // No skipping past an unanswered in-video question.
          if (lockAt !== null && event.currentTarget.currentTime > lockAt + 0.25) {
            event.currentTarget.currentTime = lockAt;
          }
          sync();
        }}
        onPause={() => {
          sync();
          report();
        }}
        onEnded={() => report(true)}
        onError={() => void recover()}
      />
      <PlayerControls
        videoRef={videoRef}
        {...state}
        lockAt={lockAt}
        markers={markers}
        onMarkerSelect={onMarkerSelect}
        fullscreen={fullscreen}
        onToggleFullscreen={() => void toggleFullscreen()}
      />
      {overlay ? <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/70 p-4">{overlay}</div> : null}
    </ProtectedSurface>
    </div>
  );
}
