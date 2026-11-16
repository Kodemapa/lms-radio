'use client';

import { unlockedUntilSec, type PlayerLessonDetail } from '@obgyn/types';
import { CheckCircle2, Lock } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRef, useState } from 'react';
import { formatClock } from '@/lib/format';
import { ProtectedPlayer, type PlayerApi } from '../protected-player';
import { CheckpointOverlay } from './checkpoint-overlay';

/** A video lesson with in-video questions that gate the rest of the video. */
export function VideoLesson({
  lesson,
  onProgress,
}: {
  lesson: PlayerLessonDetail & { media: NonNullable<PlayerLessonDetail['media']> };
  onProgress: (positionSec: number, durationSec: number, ended: boolean, allPassed: boolean) => void;
}) {
  const t = useTranslations('Checkpoint');
  const [checkpoints, setCheckpoints] = useState(lesson.checkpoints);
  const [asking, setAsking] = useState(false);
  const player = useRef<PlayerApi>(null);
  const lockAt = unlockedUntilSec(checkpoints);
  const current = checkpoints.find((c) => !c.passed && c.atSec === lockAt) ?? null;

  return (
    <div className="flex flex-col gap-3">
      <ProtectedPlayer
        assetId={lesson.media.assetId}
        title={lesson.title}
        startAt={Math.min(lesson.progress.positionSec, lockAt ?? Number.POSITIVE_INFINITY)}
        apiRef={player}
        lockAt={lockAt}
        markers={checkpoints.map(({ atSec, passed }) => ({ atSec, passed }))}
        onLockReached={() => setAsking(true)}
        onProgress={(position, duration, ended) => onProgress(position, duration, ended, lockAt === null)}
        overlay={
          asking && current ? (
            <CheckpointOverlay
              key={current.id}
              lessonId={lesson.id}
              checkpoint={current}
              onPassed={() => {
                setCheckpoints((all) => all.map((c) => (c.id === current.id ? { ...c, passed: true } : c)));
                setAsking(false);
              }}
              onClose={() => setAsking(false)}
              onRewatch={() => {
                setAsking(false);
                player.current?.seek(Math.max(0, current.atSec - 30));
                player.current?.play();
              }}
            />
          ) : null
        }
      />
      {checkpoints.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-muted-foreground">{t('timeline', { count: checkpoints.length })}</span>
          {checkpoints.map((c) => (
            <span
              key={c.id}
              className={`flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                c.passed ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200' : 'bg-muted text-muted-foreground'
              }`}
            >
              {c.passed ? <CheckCircle2 aria-hidden className="size-3.5" /> : <Lock aria-hidden className="size-3.5" />}
              {formatClock(c.atSec)}
              <span className="sr-only">{c.passed ? t('passed') : t('pending')}</span>
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}
