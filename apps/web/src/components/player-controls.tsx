'use client';

import { CheckCircle2, HelpCircle, Lock, Maximize, Minimize, Pause, Play, Volume2, VolumeX } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { type RefObject } from 'react';
import { formatClock } from '@/lib/format';

export interface PlayerMarker {
  atSec: number;
  passed: boolean;
}

const SPEEDS = [0.75, 1, 1.25, 1.5, 2];
const pct = (sec: number, duration: number) => `${Math.min(100, Math.max(0, (sec / duration) * 100))}%`;

/**
 * Custom control bar: the browser's own controls can't show question markers
 * or a locked region. Seeking is clamped to `lockAt`.
 */
export function PlayerControls({
  videoRef,
  current,
  duration,
  playing,
  muted,
  volume,
  rate,
  lockAt,
  markers,
  fullscreen,
  onToggleFullscreen,
  onMarkerSelect,
}: {
  videoRef: RefObject<HTMLVideoElement | null>;
  current: number;
  duration: number;
  playing: boolean;
  muted: boolean;
  volume: number;
  rate: number;
  lockAt: number | null;
  markers: PlayerMarker[];
  fullscreen: boolean;
  onToggleFullscreen: () => void;
  /** Authoring: clicking a marker selects that question instead of seeking before it. */
  onMarkerSelect?: (atSec: number) => void;
}) {
  const t = useTranslations('Learn');
  const video = () => videoRef.current;
  const limit = lockAt ?? duration;
  const seek = (sec: number) => {
    const v = video();
    if (v) v.currentTime = Math.max(0, Math.min(sec, limit));
  };
  const ready = duration > 0;

  return (
    <div className="absolute inset-x-0 bottom-0 z-30 flex flex-col gap-1 bg-gradient-to-t from-black/85 via-black/60 to-transparent px-3 pb-2 pt-8 text-white">
      {/* Timeline with question markers */}
      <div className="relative h-8">
        {ready
          ? markers.map((marker) => {
              const reachable = marker.atSec <= limit;
              const label = marker.passed
                ? t('questionDone', { time: formatClock(marker.atSec) })
                : t('questionMarker', { time: formatClock(marker.atSec) });
              return (
                <button
                  key={marker.atSec}
                  type="button"
                  title={label}
                  aria-label={label}
                  disabled={!reachable}
                  onClick={() => {
                    if (onMarkerSelect) {
                      seek(marker.atSec);
                      onMarkerSelect(marker.atSec);
                    } else {
                      seek(Math.max(0, marker.atSec - 3));
                    }
                  }}
                  className={`absolute top-0 z-10 flex size-5 -translate-x-1/2 items-center justify-center rounded-full shadow ring-2 ring-black/40 transition-transform hover:scale-125 disabled:cursor-not-allowed ${
                    marker.passed ? 'bg-green-500 text-white' : 'bg-amber-400 text-black'
                  }`}
                  style={{ left: pct(marker.atSec, duration) }}
                >
                  {marker.passed ? <CheckCircle2 aria-hidden className="size-3.5" /> : <HelpCircle aria-hidden className="size-3.5" />}
                </button>
              );
            })
          : null}
        <div className="absolute inset-x-0 bottom-1 h-1.5 overflow-hidden rounded-full bg-white/25">
          {ready ? (
            <>
              <div className="absolute inset-y-0 left-0 bg-primary" style={{ width: pct(current, duration) }} />
              {lockAt !== null ? (
                <div
                  className="absolute inset-y-0 right-0 bg-[repeating-linear-gradient(45deg,rgba(0,0,0,0.55)_0_4px,rgba(255,255,255,0.15)_4px_8px)]"
                  style={{ left: pct(lockAt, duration) }}
                  title={t('lockedFrom', { time: formatClock(lockAt) })}
                />
              ) : null}
              {markers.map((marker) => (
                <div
                  key={marker.atSec}
                  aria-hidden
                  className={`absolute inset-y-0 w-1 -translate-x-1/2 ${marker.passed ? 'bg-green-400' : 'bg-amber-300'}`}
                  style={{ left: pct(marker.atSec, duration) }}
                />
              ))}
            </>
          ) : null}
        </div>
        {lockAt !== null && ready ? (
          <Lock aria-hidden className="absolute bottom-3 size-3 -translate-x-1/2 text-amber-300" style={{ left: pct(lockAt, duration) }} />
        ) : null}
        <input
          type="range"
          min={0}
          max={duration || 0}
          step={0.1}
          value={Math.min(current, duration || 0)}
          disabled={!ready}
          aria-label={t('seek')}
          aria-valuetext={t('seekValue', { current: formatClock(Math.floor(current)), duration: formatClock(Math.floor(duration)) })}
          onChange={(event) => seek(Number(event.target.value))}
          className="absolute inset-x-0 bottom-0 h-4 w-full cursor-pointer opacity-0"
        />
      </div>

      <div className="flex items-center gap-2 text-sm">
        <button
          type="button"
          aria-label={playing ? t('pause') : t('play')}
          onClick={() => {
            const v = video();
            if (!v) return;
            if (v.paused) void v.play().catch(() => undefined);
            else v.pause();
          }}
          className="rounded-md p-1.5 hover:bg-white/15"
        >
          {playing ? <Pause aria-hidden className="size-5" /> : <Play aria-hidden className="size-5" />}
        </button>
        <span className="tabular-nums">
          {formatClock(Math.floor(current))} / {formatClock(Math.floor(duration))}
        </span>
        {lockAt !== null ? (
          <span className="hidden items-center gap-1 rounded-full bg-amber-400/90 px-2 py-0.5 text-xs font-medium text-black sm:flex">
            <Lock aria-hidden className="size-3" />
            {t('lockedFrom', { time: formatClock(lockAt) })}
          </span>
        ) : null}
        <span className="flex-1" />
        <button
          type="button"
          aria-label={muted ? t('unmute') : t('mute')}
          onClick={() => {
            const v = video();
            if (v) v.muted = !v.muted;
          }}
          className="rounded-md p-1.5 hover:bg-white/15"
        >
          {muted || volume === 0 ? <VolumeX aria-hidden className="size-5" /> : <Volume2 aria-hidden className="size-5" />}
        </button>
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={muted ? 0 : volume}
          aria-label={t('volume')}
          onChange={(event) => {
            const v = video();
            if (!v) return;
            v.volume = Number(event.target.value);
            v.muted = v.volume === 0;
          }}
          className="hidden w-20 accent-white sm:block"
        />
        <label className="flex items-center">
          <span className="sr-only">{t('speed')}</span>
          <select
            value={rate}
            onChange={(event) => {
              const v = video();
              if (v) v.playbackRate = Number(event.target.value);
            }}
            className="rounded-md bg-white/10 px-1.5 py-1 text-xs hover:bg-white/20 [&>option]:text-black"
          >
            {SPEEDS.map((speed) => (
              <option key={speed} value={speed}>
                {speed}×
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          aria-label={fullscreen ? t('exitFullscreen') : t('fullscreen')}
          onClick={onToggleFullscreen}
          className="rounded-md p-1.5 hover:bg-white/15"
        >
          {fullscreen ? <Minimize aria-hidden className="size-5" /> : <Maximize aria-hidden className="size-5" />}
        </button>
      </div>
    </div>
  );
}
