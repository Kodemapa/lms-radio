'use client';

import {
  formatCountdown,
  PlayerLessonDetailSchema,
  secondsLeft,
  type ExamSessionPublic,
  type LearnerEventKind,
  type PlayerExam,
  type PlayerLessonDetail,
  type QuizResult,
} from '@obgyn/types';
import { Button, Label, Textarea, toast } from '@obgyn/ui';
import { AlertTriangle, Camera, CheckCircle2, Clock, Maximize, MessageSquare, ScanFace, ShieldCheck, Video, XCircle } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { api, ApiClientError } from '@/lib/instructor-api';
import { answerViewer, EXAM_CAMERA, randomId } from '@/lib/live-camera';
import { startAiMonitor, type ProctorModels } from '@/lib/proctor-ai';
import { ExamIntegritySummary } from './exam-integrity';
import { ExamSystemCheck, type ExamMedia } from './exam-system-check';
import { MediaPermissionDialog } from './media-permission-dialog';
import { QuizLesson } from './quiz-lesson';

type Quiz = NonNullable<PlayerLessonDetail['quiz']>;

const HEARTBEAT_MS = 5000;
const OFFER_POLL_MS = 1500;

function isFullscreen(): boolean {
  return typeof document !== 'undefined' && !!document.fullscreenElement;
}

/**
 * A timed exam on a quiz lesson. Before it starts: rules and consent. While it runs:
 * countdown, full screen, and (if proctored) the live camera streamed to proctors,
 * with tab switches, leaving full screen and the camera going off reported to them.
 */
export function ExamLesson({ lesson, quiz, exam }: { lesson: PlayerLessonDetail; quiz: Quiz; exam: PlayerExam }) {
  const t = useTranslations('Exam');
  const format = useFormatter();
  const router = useRouter();
  const [session, setSession] = useState<ExamSessionPublic | null>(exam.session);
  const [questions, setQuestions] = useState<Quiz | null>(exam.session?.status === 'IN_PROGRESS' && quiz.questions.length ? quiz : null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [running, setRunning] = useState(false);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const [consent, setConsent] = useState(false);
  const [media, setMedia] = useState<ExamMedia | null>(null);
  const [checkReady, setCheckReady] = useState(false);
  const [result, setResult] = useState<QuizResult | null>(null);
  const offset = useRef(new Date(exam.serverNow).getTime() - Date.now());

  const finished = session && session.status !== 'IN_PROGRESS';
  const now = new Date(Date.now() + offset.current);
  const notOpen = !!exam.opensAt && now < new Date(exam.opensAt);
  const closed = !!exam.closesAt && now >= new Date(exam.closesAt);

  const stopCamera = useCallback(() => {
    stream?.getTracks().forEach((track) => track.stop());
    media?.audio?.getTracks().forEach((track) => track.stop());
    setStream(null);
  }, [stream, media]);

  const start = async () => {
    setStarting(true);
    setStartError(null);
    // Full screen must be requested straight from the click (browsers allow it only then),
    // so before waiting for the camera. Not awaited: some browsers never settle it.
    void document.documentElement.requestFullscreen?.().catch(() => undefined);
    // Proctored: the camera was switched on by the system check above.
    const camera = exam.proctored ? (media?.stream ?? null) : null;
    try {
      if (exam.proctored && !camera) {
        setStartError(t('cameraDenied'));
        if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
        return;
      }
      const started = await api<PlayerExam>('POST', `learn/lessons/${lesson.id}/exam/start`);
      offset.current = new Date(started.serverNow).getTime() - Date.now();
      const detail = PlayerLessonDetailSchema.parse(await api('GET', `learn/lessons/${lesson.id}`));
      if (!detail.quiz || !started.session) throw new Error('missing');
      setQuestions(detail.quiz);
      setSession(started.session);
      setStream(camera);
      setRunning(true);
    } catch (error) {
      const code = error instanceof ApiClientError ? error.body?.code : undefined;
      setStartError(
        code === 'EXAM_NOT_OPEN' ? t('notOpenYet') : code === 'EXAM_CLOSED' ? t('closed') : code === 'EXAM_FINISHED' ? t('alreadyDone') : t('startFailed'),
      );
      if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
    } finally {
      setStarting(false);
    }
  };

  const onFinished = (next: QuizResult | null) => {
    setResult(next);
    setRunning(false);
    stopCamera();
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
    router.refresh();
  };

  if (running && session && questions) {
    return (
      <ExamRunner
        lessonId={lesson.id}
        quiz={questions}
        exam={exam}
        session={session}
        stream={stream}
        audio={media?.audio ?? null}
        models={media?.models ?? null}
        onReconnect={(nextStream, nextAudio) => {
          // Camera / microphone turned back on during the exam: swap in the new streams.
          if (nextStream && nextStream !== stream) {
            stream?.getTracks().forEach((track) => track.stop());
            setStream(nextStream);
          }
          setMedia((current) => {
            const base = current ?? { stream: nextStream ?? stream!, audio: null, models: null };
            if (nextAudio && nextAudio !== base.audio) base.audio?.getTracks().forEach((track) => track.stop());
            return { ...base, stream: nextStream ?? base.stream, audio: nextAudio ?? base.audio };
          });
        }}
        offsetMs={offset.current}
        onSession={setSession}
        onFinished={onFinished}
      />
    );
  }

  if (finished || result) {
    const status = session?.status ?? 'SUBMITTED';
    const score = result ?? quiz.lastResult;
    return (
      <section className="flex flex-col gap-4 surface p-6" aria-live="polite">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          {status === 'TERMINATED' ? <XCircle aria-hidden className="size-6 text-destructive" /> : <CheckCircle2 aria-hidden className="size-6 text-success" />}
          {status === 'TERMINATED' ? t('endedByProctor') : status === 'EXPIRED' ? t('expired') : t('submitted')}
        </h2>
        {status === 'TERMINATED' && session?.terminatedReason ? <p className="text-sm">{t('reason', { reason: session.terminatedReason })}</p> : null}
        {score ? (
          <p className={`text-lg font-semibold ${score.passed ? 'text-success' : 'text-destructive'}`}>
            {score.passed ? t('passed', { score: score.scorePercent }) : t('notPassed', { score: score.scorePercent, pass: score.passPercent })}
          </p>
        ) : null}
        <p className="text-sm text-muted-foreground">{t('oneAttempt')}</p>
        {exam.proctored && session ? <ExamIntegritySummary sessionId={session.id} /> : null}
      </section>
    );
  }

  const resuming = session?.status === 'IN_PROGRESS';
  // Consent was given when the exam started; resuming only needs the camera again.
  const canStart =
    lesson.enrolled && (!exam.proctored || checkReady) && (resuming || ((!notOpen && !closed) && (!exam.proctored || consent)));
  const showCheck = exam.proctored && lesson.enrolled && (resuming || (!notOpen && !closed));

  return (
    <section className="flex flex-col gap-5 surface p-6">
      <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
        <span className="flex items-center gap-2"><Clock aria-hidden className="size-4 text-primary" />{t('duration', { minutes: exam.durationMin })}</span>
        <span>{t('questions', { count: quiz.questions.length || 0 })}</span>
        <span>{t('passMark', { percent: quiz.passPercent })}</span>
        {exam.opensAt ? <span>{t('opens', { at: format.dateTime(new Date(exam.opensAt), { dateStyle: 'medium', timeStyle: 'short' }) })}</span> : null}
        {exam.closesAt ? <span>{t('closes', { at: format.dateTime(new Date(exam.closesAt), { dateStyle: 'medium', timeStyle: 'short' }) })}</span> : null}
      </div>

      <div className="rounded-xl bg-muted p-4 text-sm">
        <p className="mb-2 font-semibold">{t('rulesTitle')}</p>
        <ul className="flex list-disc flex-col gap-1 pl-5">
          <li>{t('ruleOneAttempt')}</li>
          <li>{t('ruleTimer', { minutes: exam.durationMin })}</li>
          <li>{t('ruleFullscreen')}</li>
          {exam.proctored ? <li>{t('ruleCamera')}</li> : null}
          {exam.proctored ? <li>{t('ruleNoRecording')}</li> : null}
          {exam.aiMonitoring ? <li>{t('ruleAi')}</li> : null}
          {exam.maxWarnings > 0 ? <li>{t('ruleMaxWarnings', { count: exam.maxWarnings })}</li> : null}
        </ul>
      </div>

      {showCheck ? (
        <ExamSystemCheck lessonId={lesson.id} ai={exam.aiMonitoring} onMedia={setMedia} onReady={setCheckReady} />
      ) : null}

      {exam.proctored && !resuming ? (
        <label className="flex items-start gap-3 text-sm">
          <input type="checkbox" className="mt-0.5 size-4 accent-[var(--primary)]" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
          <span>{exam.aiMonitoring ? t('consentAi') : t('consent')}</span>
        </label>
      ) : null}

      {resuming ? <p role="status" className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-900/30 dark:text-amber-100">{t('resumeHint')}</p> : null}
      {notOpen && !resuming ? <p className="text-sm text-muted-foreground">{t('notOpenYet')}</p> : null}
      {closed && !resuming ? <p className="text-sm text-destructive">{t('closed')}</p> : null}
      {!lesson.enrolled ? <p className="text-sm text-muted-foreground">{t('enrolFirst')}</p> : null}
      {startError ? <p role="alert" className="text-sm text-destructive">{startError}</p> : null}

      <div>
        <Button size="lg" disabled={!canStart || starting} onClick={() => void start()}>
          {exam.proctored ? <Camera aria-hidden className="size-4" /> : <ShieldCheck aria-hidden className="size-4" />}
          {starting ? t('starting') : resuming ? t('resume') : t('start')}
        </Button>
      </div>
    </section>
  );
}

/** The running exam: countdown, camera, full-screen gate, warnings and the questions. */
function ExamRunner({
  lessonId,
  quiz,
  exam,
  session,
  stream,
  audio,
  models,
  onReconnect,
  offsetMs,
  onSession,
  onFinished,
}: {
  lessonId: string;
  quiz: Quiz;
  exam: PlayerExam;
  session: ExamSessionPublic;
  stream: MediaStream | null;
  audio: MediaStream | null;
  models: ProctorModels | null;
  /** New camera / microphone streams after they were turned back on. */
  onReconnect: (stream: MediaStream | null, audio: MediaStream | null) => void;
  offsetMs: number;
  onSession: (session: ExamSessionPublic) => void;
  onFinished: (result: QuizResult | null) => void;
}) {
  const t = useTranslations('Exam');
  const [left, setLeft] = useState(() => secondsLeft(session.endsAt, offsetMs));
  const [fullscreen, setFullscreen] = useState(isFullscreen);
  const [cameraOn, setCameraOn] = useState(!!stream);
  const [micOn, setMicOn] = useState(true);
  const [watching, setWatching] = useState(0);
  const [warnings, setWarnings] = useState(session.warnings);
  // Warnings acknowledged on this page (the server confirms on the next heartbeat).
  const [readHere, setReadHere] = useState<Set<string>>(() => new Set());
  const continueButton = useRef<HTMLButtonElement>(null);
  const [notices, setNotices] = useState(session.notices);
  const seenNotices = useRef(new Set(session.notices.map((n) => n.id)));
  const [disputing, setDisputing] = useState(false);
  const [disputeNote, setDisputeNote] = useState('');
  const answered = useRef(0);
  const [ending, setEnding] = useState<null | 'time' | 'terminated'>(null);
  const submitRef = useRef<(() => Promise<void>) | null>(null);
  const preview = useRef<HTMLVideoElement>(null);
  const epoch = useRef(randomId());
  const peers = useRef(new Map<string, RTCPeerConnection>());
  // Callbacks from the parent change identity on every render; keep the latest in a ref
  // so the heartbeat and timers don't restart (and re-send) each time.
  const callbacks = useRef({ onSession, onFinished, t });
  callbacks.current = { onSession, onFinished, t };
  const done = useRef(false);
  const state = useRef({ fullscreen, cameraOn, visible: true });
  state.current = { fullscreen, cameraOn, visible: typeof document === 'undefined' || document.visibilityState === 'visible' };
  const proctored = exam.proctored;

  const report = useCallback(
    (kind: LearnerEventKind, extra: { object?: string; snapshot?: string } = {}) =>
      void api('POST', `learn/exam-sessions/${session.id}/events`, { kind, ...extra }).catch(() => undefined),
    [session.id],
  );

  const finish = useCallback(
    async (why: 'time' | 'terminated') => {
      if (done.current) return;
      setEnding((current) => current ?? why);
      try {
        await submitRef.current?.();
      } finally {
        peers.current.forEach((pc) => pc.close());
        peers.current.clear();
        // The answers couldn't be submitted (e.g. already closed by the server): still leave the exam.
        if (!done.current) {
          done.current = true;
          callbacks.current.onFinished(null);
        }
      }
    },
    [],
  );

  // Countdown; at 0:00 the answers are submitted automatically.
  useEffect(() => {
    const timer = window.setInterval(() => {
      const next = secondsLeft(session.endsAt, offsetMs);
      setLeft(next);
      if (next <= 0) void finish('time');
    }, 1000);
    return () => window.clearInterval(timer);
  }, [session.endsAt, offsetMs, finish]);

  // Self-view and camera state.
  useEffect(() => {
    if (preview.current && stream) preview.current.srcObject = stream;
    const track = stream?.getVideoTracks()[0];
    if (!track) return;
    // A new camera stream (e.g. turned back on): proctors reconnect to it.
    epoch.current = randomId();
    setCameraOn(track.readyState === 'live' && !track.muted);
    report('CAMERA_ON');
    const off = () => {
      setCameraOn(false);
      report('CAMERA_OFF');
    };
    track.addEventListener('ended', off);
    track.addEventListener('mute', off);
    const on = () => {
      setCameraOn(true);
      report('CAMERA_ON');
    };
    track.addEventListener('unmute', on);
    return () => {
      track.removeEventListener('ended', off);
      track.removeEventListener('mute', off);
      track.removeEventListener('unmute', on);
    };
  }, [stream, report]);

  // Microphone (AI voice check): notice when it is switched off.
  useEffect(() => {
    const track = audio?.getAudioTracks()[0];
    if (!exam.aiMonitoring || !track) return;
    setMicOn(track.readyState === 'live');
    const off = () => setMicOn(false);
    const on = () => setMicOn(true);
    track.addEventListener('ended', off);
    track.addEventListener('unmute', on);
    return () => {
      track.removeEventListener('ended', off);
      track.removeEventListener('unmute', on);
    };
  }, [audio, exam.aiMonitoring]);

  // Camera or microphone off for more than a moment: a popup asks to turn it back on.
  const needCamera = proctored && !cameraOn;
  const needMic = exam.aiMonitoring && !micOn;
  const [askMedia, setAskMedia] = useState(false);
  useEffect(() => {
    if (ending || (!needCamera && !needMic)) {
      setAskMedia(false);
      return;
    }
    const timer = window.setTimeout(() => setAskMedia(true), 2000);
    return () => window.clearTimeout(timer);
  }, [needCamera, needMic, ending]);
  const reconnectMedia = async (): Promise<boolean> => {
    let nextStream: MediaStream | null = null;
    let nextAudio: MediaStream | null = null;
    try {
      if (needCamera) nextStream = await navigator.mediaDevices.getUserMedia(EXAM_CAMERA);
      if (needMic) nextAudio = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true }, video: false });
    } catch {
      nextStream?.getTracks().forEach((track) => track.stop());
      return false;
    }
    onReconnect(nextStream, nextAudio);
    if (nextStream) setCameraOn(true);
    if (nextAudio) setMicOn(true);
    return true;
  };

  // Tab switches, leaving full screen, copy/paste.
  useEffect(() => {
    const onVisibility = () => report(document.visibilityState === 'visible' ? 'TAB_VISIBLE' : 'TAB_HIDDEN');
    const onBlur = () => report('WINDOW_BLUR');
    const onFullscreen = () => {
      const on = isFullscreen();
      setFullscreen(on);
      report(on ? 'FULLSCREEN_ENTER' : 'FULLSCREEN_EXIT');
    };
    const onClipboard = (event: Event) => {
      event.preventDefault();
      report('COPY_PASTE');
    };
    const block = (event: Event) => event.preventDefault();
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('blur', onBlur);
    document.addEventListener('fullscreenchange', onFullscreen);
    document.addEventListener('copy', onClipboard);
    document.addEventListener('cut', onClipboard);
    document.addEventListener('paste', onClipboard);
    document.addEventListener('contextmenu', block);
    if (!isFullscreen()) report('FULLSCREEN_EXIT');
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('blur', onBlur);
      document.removeEventListener('fullscreenchange', onFullscreen);
      document.removeEventListener('copy', onClipboard);
      document.removeEventListener('cut', onClipboard);
      document.removeEventListener('paste', onClipboard);
      document.removeEventListener('contextmenu', block);
    };
  }, [report]);

  // Heartbeat: tells proctors we're here; brings back warnings and whether the exam was ended.
  useEffect(() => {
    let stopped = false;
    const beat = async () => {
      try {
        const reply = await api<ExamSessionPublic & { serverNow: string }>('POST', `learn/exam-sessions/${session.id}/heartbeat`, {
          camera: state.current.cameraOn,
          fullscreen: state.current.fullscreen,
          visible: state.current.visible,
          epoch: epoch.current,
          answered: answered.current,
        });
        if (stopped || done.current) return;
        callbacks.current.onSession(reply);
        setWarnings(reply.warnings);
        setNotices(reply.notices);
        for (const notice of reply.notices) {
          if (seenNotices.current.has(notice.id)) continue;
          seenNotices.current.add(notice.id);
          toast.info(callbacks.current.t('noticeToast', { message: notice.message }));
        }
        if (reply.status === 'TERMINATED') void finish('terminated');
        else if (reply.status !== 'IN_PROGRESS') {
          done.current = true;
          callbacks.current.onFinished(null);
        }
      } catch {
        // offline for a moment: the next beat retries
      }
    };
    void beat();
    const timer = window.setInterval(() => void beat(), HEARTBEAT_MS);
    return () => {
      stopped = true;
      window.clearInterval(timer);
    };
  }, [session.id, finish]);

  // Live camera: answer every proctor who asks to watch.
  useEffect(() => {
    if (!proctored || !stream) return;
    let stopped = false;
    const poll = async () => {
      try {
        const offers = await api<{ peerId: string; sdp: string }[]>('GET', `learn/exam-sessions/${session.id}/offers`);
        for (const offer of offers) {
          if (stopped) return;
          peers.current.get(offer.peerId)?.close();
          const { pc, sdp } = await answerViewer(exam.iceServers, offer.sdp, stream);
          peers.current.set(offer.peerId, pc);
          const count = () =>
            setWatching([...peers.current.values()].filter((p) => p.connectionState === 'connected').length);
          pc.addEventListener('connectionstatechange', () => {
            if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
              pc.close();
              if (peers.current.get(offer.peerId) === pc) peers.current.delete(offer.peerId);
            }
            count();
          });
          await api('POST', `learn/exam-sessions/${session.id}/answer`, { peerId: offer.peerId, sdp }).catch(() => undefined);
        }
      } catch {
        // try again next poll
      }
    };
    const timer = window.setInterval(() => void poll(), OFFER_POLL_MS);
    void poll();
    const connections = peers.current;
    return () => {
      stopped = true;
      window.clearInterval(timer);
      connections.forEach((pc) => pc.close());
      connections.clear();
    };
  }, [proctored, stream, session.id, exam.iceServers]);

  // AI checks in this browser: alerts (with a small evidence snapshot) go to the proctors.
  useEffect(() => {
    const video = preview.current;
    if (!exam.aiMonitoring || !models || !video || !stream) return;
    const monitor = startAiMonitor({
      models,
      video,
      audio,
      onAlert: (alert) => {
        if (done.current) return;
        report(alert.kind, { ...(alert.object ? { object: alert.object } : {}), ...(alert.snapshot ? { snapshot: alert.snapshot } : {}) });
        toast.info(callbacks.current.t(`aiAlert.${alert.kind}`));
      },
    });
    return () => monitor.stop();
  }, [exam.aiMonitoring, models, stream, audio, report]);

  // An unread warning blanks the whole screen until the learner clicks to continue.
  const unread = ending ? [] : warnings.filter((w) => !w.acknowledged && !readHere.has(w.id));
  const blocking = unread[0] ?? null;
  useEffect(() => {
    if (blocking) continueButton.current?.focus();
  }, [blocking]);
  const acknowledge = (warningId: string, note?: string) => {
    setReadHere((current) => new Set(current).add(warningId));
    setDisputing(false);
    setDisputeNote('');
    void api('POST', `learn/exam-sessions/${session.id}/events`, note ? { kind: 'WARNING_DISPUTED', warningId, note } : { kind: 'WARNING_ACKNOWLEDGED', warningId }).catch(
      () => undefined,
    );
  };
  const max = exam.maxWarnings;
  const warningNumber = blocking ? warnings.findIndex((w) => w.id === blocking.id) + 1 : 0;
  const warningText = (w: (typeof warnings)[number]) => (w.code ? t(`autoWarning.${w.code}`) : w.message);

  const lowTime = left <= 60;
  return (
    <div className="flex flex-col gap-4">
      <MediaPermissionDialog
        open={askMedia && !blocking}
        camera={needCamera}
        mic={needMic}
        dismissible={false}
        onRetry={reconnectMedia}
        onClose={() => undefined}
      />
      {blocking ? (
        <div
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="exam-warning-title"
          aria-describedby="exam-warning-message"
          className="fixed inset-0 z-[200] grid place-items-center bg-background p-4"
        >
          <div className="flex w-full max-w-lg flex-col items-center gap-5 rounded-3xl border-2 border-destructive bg-card p-8 text-center shadow-2xl">
            <span className="grid size-16 place-items-center rounded-full bg-destructive/10">
              <AlertTriangle aria-hidden className="size-9 text-destructive" />
            </span>
            <h2 id="exam-warning-title" className="text-xl font-semibold text-destructive">
              {max > 0 ? t('warningNumbered', { number: warningNumber, max }) : t('warningTitle')}
            </h2>
            <p id="exam-warning-message" className="text-lg font-medium">{warningText(blocking)}</p>
            {blocking.code ? <p className="text-sm text-muted-foreground">{t('warningAuto')}</p> : null}
            {max > 0 && warningNumber === max - 1 ? (
              <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive">{t('warningLastChance')}</p>
            ) : null}
            <p className="text-sm text-muted-foreground">
              {t('warningTimerRunning', { time: formatCountdown(left) })}
              {unread.length > 1 ? ` ${t('warningMore', { count: unread.length - 1 })}` : ''}
            </p>
            {disputing ? (
              <div className="flex w-full flex-col gap-2 text-left">
                <Label htmlFor="dispute-note">{t('disputeLabel')}</Label>
                <Textarea id="dispute-note" rows={3} maxLength={500} value={disputeNote} onChange={(e) => setDisputeNote(e.target.value)} autoFocus />
                <div className="flex flex-wrap justify-end gap-2">
                  <Button variant="outline" onClick={() => setDisputing(false)}>{t('disputeCancel')}</Button>
                  <Button disabled={!disputeNote.trim()} onClick={() => acknowledge(blocking.id, disputeNote.trim())}>{t('disputeSend')}</Button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <Button ref={continueButton} size="lg" onClick={() => acknowledge(blocking.id)}>
                  {t('warningContinue')}
                </Button>
                <button type="button" className="text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground" onClick={() => setDisputing(true)}>
                  {t('dispute')}
                </button>
              </div>
            )}
          </div>
        </div>
      ) : null}
      <div className="sticky top-2 z-30 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card/95 p-3 shadow-sm backdrop-blur">
        <div className="flex items-center gap-3">
          <span
            role="timer"
            aria-label={t('timeLeftLabel')}
            className={`flex items-center gap-2 rounded-full px-3 py-1 text-lg font-semibold tabular-nums ${lowTime ? 'bg-destructive/10 text-destructive' : 'bg-primary-light text-primary'}`}
          >
            <Clock aria-hidden className="size-5" />
            {formatCountdown(left)}
          </span>
          {proctored ? (
            <span className={`flex items-center gap-1.5 text-sm ${cameraOn ? 'text-success' : 'text-destructive'}`}>
              <Video aria-hidden className="size-4" />
              {cameraOn ? (watching > 0 ? t('liveWatching') : t('cameraOn')) : t('cameraOff')}
            </span>
          ) : null}
          {exam.aiMonitoring && models ? (
            <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <ScanFace aria-hidden className="size-4" />
              {t('aiOn')}
            </span>
          ) : null}
          {max > 0 ? (
            <span className={`rounded-full px-2.5 py-0.5 text-sm font-medium tabular-nums ${warnings.length ? 'bg-destructive/10 text-destructive' : 'bg-muted'}`}>
              {t('warningsCount', { count: warnings.length, max })}
            </span>
          ) : null}
        </div>
        {proctored ? (
          <video ref={preview} autoPlay muted playsInline aria-label={t('selfView')} className="h-16 w-24 rounded-lg bg-black object-cover" />
        ) : null}
      </div>

      {warnings.length > 0 ? (
        <div role="alert" className="flex flex-col gap-1 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-900/30 dark:text-amber-100">
          <p className="flex items-center gap-2 font-semibold"><AlertTriangle aria-hidden className="size-4" />{t('warningsTitle')}</p>
          {warnings.slice(-3).map((w) => <p key={w.id}>{warningText(w)}</p>)}
        </div>
      ) : null}

      {notices.length > 0 ? (
        <div role="status" className="flex flex-col gap-1 rounded-xl border border-border bg-primary-light p-3 text-sm">
          <p className="flex items-center gap-2 font-semibold text-primary"><MessageSquare aria-hidden className="size-4" />{t('noticesTitle')}</p>
          {notices.slice(-3).map((n) => <p key={n.id}>{n.message}</p>)}
        </div>
      ) : null}

      {proctored && !cameraOn ? (
        <p role="alert" className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive">{t('cameraOffAlert')}</p>
      ) : null}

      {ending ? (
        <p role="status" className="rounded-xl bg-muted p-3 text-sm">{ending === 'time' ? t('timeUp') : t('endingByProctor')}</p>
      ) : null}

      <div className="relative">
        {!fullscreen && !ending ? (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-start gap-3 rounded-2xl bg-background/95 p-10 text-center">
            <Maximize aria-hidden className="size-10 text-primary" />
            <p className="max-w-md font-medium">{t('fullscreenRequired')}</p>
            <Button onClick={() => void document.documentElement.requestFullscreen?.().catch(() => undefined)}>{t('returnFullscreen')}</Button>
          </div>
        ) : null}
        <QuizLesson
          lessonId={lessonId}
          quiz={quiz}
          enrolled
          exam={{
            storageKey: `exam-answers:${session.id}`,
            registerSubmit: (submit) => {
              submitRef.current = submit;
            },
            onSubmitted: (result) => {
              done.current = true;
              callbacks.current.onFinished(result);
            },
            locked: (!fullscreen || !!blocking) && !ending,
            onProgress: (count) => {
              answered.current = count;
            },
          }}
        />
      </div>
    </div>
  );
}
