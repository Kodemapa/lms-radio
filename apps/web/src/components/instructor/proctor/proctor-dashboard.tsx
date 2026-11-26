'use client';

import {
  AI_EVENT_KINDS,
  ALERT_EVENT_KINDS,
  ExamReportSchema,
  formatCountdown,
  ProctorDashboardSchema,
  secondsLeft,
  type ExamReport,
  type IceServer,
  type ProctorDashboard as Dashboard,
  type ProctorEventView,
  type ProctorSession,
} from '@obgyn/types';
import { Button, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, Label, Textarea, toast } from '@obgyn/ui';
import {
  AlertTriangle,
  ArrowLeft,
  Ban,
  ClipboardCheck,
  Clock,
  Image as ImageIcon,
  Maximize2,
  Megaphone,
  MessageSquare,
  Minimize2,
  MonitorOff,
  ScanFace,
  Video,
  VideoOff,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { useFormatter, useNow, useTranslations } from 'next-intl';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from '@/i18n/navigation';
import { api, ApiClientError } from '@/lib/instructor-api';
import { createViewerOffer, randomId } from '@/lib/live-camera';
import { eventDetail, IntegrityReportView } from '@/components/player/exam-integrity';

const POLL_MS = 3000;
const ANSWER_POLL_MS = 1500;
/** No answer to an offer within this time: try again. */
const OFFER_TIMEOUT_MS = 20_000;
/** An AI alert this recent is shown on the learner's tile. */
const RECENT_FLAG_MS = 2 * 60_000;

type Filter = 'all' | 'attention' | 'offline';

interface Viewer {
  pc: RTCPeerConnection;
  epoch: string | null;
  offeredAt: number;
  stream: MediaStream | null;
}

/**
 * Live proctoring: one tile per learner with their camera (streamed straight from
 * their browser to this one), time left and state, plus the alert feed. Proctors can
 * warn a learner or end their exam.
 */
export function ProctorDashboard({ lessonId }: { lessonId: string }) {
  const t = useTranslations('Proctor');
  const tCommon = useTranslations('Common');
  const format = useFormatter();
  const now = useNow({ updateInterval: 1000 });
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [streams, setStreams] = useState<Record<string, MediaStream>>({});
  const [focus, setFocus] = useState<string | null>(null);
  const [warnFor, setWarnFor] = useState<ProctorSession | null>(null);
  const [endFor, setEndFor] = useState<ProctorSession | null>(null);
  const [messageFor, setMessageFor] = useState<ProctorSession | 'all' | null>(null);
  const [reviewFor, setReviewFor] = useState<ProctorSession | null>(null);
  const [snapshotId, setSnapshotId] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const tExam = useTranslations('Exam');
  const peerId = useRef(randomId());
  const viewers = useRef(new Map<string, Viewer>());
  const offset = useRef(0);

  const load = useCallback(async () => {
    try {
      const next = ProctorDashboardSchema.parse(await api('GET', `instructor/exams/${lessonId}/proctor`));
      offset.current = new Date(next.serverNow).getTime() - Date.now();
      setData(next);
      setError(null);
    } catch (e) {
      setError(e instanceof ApiClientError && e.status === 403 ? t('forbidden') : e instanceof ApiClientError && e.status === 404 ? t('notFound') : tCommon('genericError'));
    }
  }, [lessonId, t, tCommon]);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), POLL_MS);
    return () => window.clearInterval(timer);
  }, [load]);

  // Connect to every learner who is live with the camera on; reconnect when their page reloads.
  useEffect(() => {
    if (!data?.lesson.proctored) return;
    const live = new Map(data.sessions.filter((s) => s.status === 'IN_PROGRESS').map((s) => [s.id, s]));
    for (const [id, viewer] of viewers.current) {
      if (!live.has(id)) {
        viewer.pc.close();
        viewers.current.delete(id);
        setStreams((current) => Object.fromEntries(Object.entries(current).filter(([key]) => key !== id)));
      }
    }
    for (const session of live.values()) {
      if (!session.online || !session.cameraOn) continue;
      const viewer = viewers.current.get(session.id);
      const state = viewer?.pc.connectionState;
      const waiting = viewer && !viewer.pc.remoteDescription && Date.now() - viewer.offeredAt < OFFER_TIMEOUT_MS;
      const healthy = viewer && (state === 'connected' || state === 'connecting' || state === 'new') && viewer.epoch === session.streamEpoch;
      if (waiting || (healthy && viewer.pc.remoteDescription)) continue;
      viewer?.pc.close();
      void connect(session.id, session.streamEpoch, data.iceServers);
    }
  }, [data]);

  async function connect(sessionId: string, epoch: string | null, iceServers: IceServer[]) {
    const placeholder: Viewer = { pc: new RTCPeerConnection(), epoch, offeredAt: Date.now(), stream: null };
    viewers.current.set(sessionId, placeholder);
    try {
      const { pc, sdp } = await createViewerOffer(iceServers);
      placeholder.pc.close();
      const viewer: Viewer = { pc, epoch, offeredAt: Date.now(), stream: null };
      viewers.current.set(sessionId, viewer);
      pc.addEventListener('track', (event) => {
        const stream = event.streams[0] ?? new MediaStream([event.track]);
        viewer.stream = stream;
        setStreams((current) => ({ ...current, [sessionId]: stream }));
      });
      await api('POST', `instructor/exam-sessions/${sessionId}/offer`, { peerId: peerId.current, sdp });
    } catch {
      viewers.current.delete(sessionId);
    }
  }

  // Pick up learners' answers to our offers.
  useEffect(() => {
    if (!data?.lesson.proctored) return;
    const timer = window.setInterval(async () => {
      if (![...viewers.current.values()].some((v) => !v.pc.remoteDescription)) return;
      try {
        const answers = await api<{ sessionId: string; sdp: string }[]>(
          'GET',
          `instructor/exams/${lessonId}/answers?peer=${peerId.current}`,
        );
        for (const answer of answers) {
          const viewer = viewers.current.get(answer.sessionId);
          if (viewer && !viewer.pc.remoteDescription) await viewer.pc.setRemoteDescription({ type: 'answer', sdp: answer.sdp }).catch(() => undefined);
        }
      } catch {
        // next poll
      }
    }, ANSWER_POLL_MS);
    return () => window.clearInterval(timer);
  }, [data?.lesson.proctored, lessonId]);

  useEffect(() => {
    const all = viewers.current;
    return () => all.forEach((viewer) => viewer.pc.close());
  }, []);

  if (error && !data) return <p role="alert" className="text-destructive">{error}</p>;
  if (!data) return <p role="status">{tCommon('loading')}</p>;

  const byId = new Map(data.sessions.map((s) => [s.id, s]));
  const running = data.sessions.filter((s) => s.status === 'IN_PROGRESS');
  const finished = data.sessions.filter((s) => s.status !== 'IN_PROGRESS');
  const notStarted = Math.max(0, data.enrolledCount - data.sessions.length);
  const clock = now.getTime();
  const recentFlag = new Map<string, ProctorEventView>();
  for (const event of data.events) {
    if (AI_EVENT_KINDS.includes(event.kind as never) && clock - new Date(event.at).getTime() < RECENT_FLAG_MS && !recentFlag.has(event.sessionId)) {
      recentFlag.set(event.sessionId, event);
    }
  }
  const proctored = data.lesson.proctored;
  const needsAttention = (s: ProctorSession) =>
    !s.online || (proctored && !s.cameraOn) || !s.fullscreen || !s.tabVisible || s.unreadWarnings > 0 || recentFlag.has(s.id);
  const attention = running.filter(needsAttention);
  const shown = filter === 'attention' ? attention : filter === 'offline' ? running.filter((s) => !s.online) : running;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href={`/instructor/courses/${data.lesson.courseId}`} className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft aria-hidden className="size-4" />
            {data.lesson.courseTitle}
          </Link>
          <h1 className="text-2xl font-semibold">{t('title', { exam: data.lesson.title })}</h1>
          <p className="text-sm text-muted-foreground">
            {t('meta', { minutes: data.lesson.durationMin })}
            {data.lesson.opensAt ? ` · ${t('opens', { at: format.dateTime(new Date(data.lesson.opensAt), { dateStyle: 'medium', timeStyle: 'short' }) })}` : ''}
            {data.lesson.closesAt ? ` · ${t('closes', { at: format.dateTime(new Date(data.lesson.closesAt), { dateStyle: 'medium', timeStyle: 'short' }) })}` : ''}
          </p>
        </div>
        <dl className="grid grid-cols-4 gap-2 text-center text-sm">
          {[
            [t('stat.running'), running.length],
            [t('stat.finished'), finished.length],
            [t('stat.notStarted'), notStarted],
            [t('stat.attention'), attention.length],
          ].map(([label, value]) => (
            <div key={String(label)} className="rounded-xl border border-border bg-card px-3 py-2">
              <dt className="text-xs text-muted-foreground">{label}</dt>
              <dd className="text-xl font-semibold tabular-nums">{value}</dd>
            </div>
          ))}
        </dl>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div role="group" aria-label={t('filter.label')} className="flex flex-wrap gap-1.5">
          {(['all', 'attention', 'offline'] as const).map((key) => (
            <button
              key={key}
              type="button"
              aria-pressed={filter === key}
              onClick={() => setFilter(key)}
              className={`rounded-full border px-3 py-1 text-sm ${filter === key ? 'border-primary bg-primary text-primary-foreground' : 'border-border hover:border-primary'}`}
            >
              {t(`filter.${key}`)}
            </button>
          ))}
        </div>
        {data.lesson.aiMonitoring ? (
          <span className="flex items-center gap-1.5 text-sm text-muted-foreground"><ScanFace aria-hidden className="size-4" />{t('aiOn')}</span>
        ) : null}
        {data.lesson.maxWarnings > 0 ? <span className="text-sm text-muted-foreground">{t('limitInfo', { count: data.lesson.maxWarnings })}</span> : null}
        <Button size="sm" variant="outline" className="ml-auto" disabled={running.length === 0} onClick={() => setMessageFor('all')}>
          <Megaphone aria-hidden className="size-4" />
          {t('messageAll')}
        </Button>
      </div>

      {!data.lesson.proctored ? <p className="rounded-xl bg-muted p-3 text-sm">{t('notProctored')}</p> : null}
      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}

      <div className="grid gap-5 xl:grid-cols-[1fr_340px]">
        <section aria-label={t('liveTitle')} className="flex flex-col gap-3">
          <h2 className="font-semibold">{t('liveTitle')}</h2>
          {shown.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
              {running.length === 0 ? t('noneRunning') : t('noneMatch')}
            </p>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
              {shown.map((s) => (
                <LearnerTile
                  key={s.id}
                  session={s}
                  flag={recentFlag.get(s.id) ?? null}
                  maxWarnings={data.lesson.maxWarnings}
                  questionCount={data.lesson.questionCount}
                  onMessage={() => setMessageFor(s)}
                  stream={streams[s.id] ?? null}
                  proctored={data.lesson.proctored}
                  left={secondsLeft(s.endsAt, offset.current, clock)}
                  focused={focus === s.id}
                  onFocus={() => setFocus(focus === s.id ? null : s.id)}
                  onWarn={() => setWarnFor(s)}
                  onEnd={() => setEndFor(s)}
                />
              ))}
            </ul>
          )}

          {finished.length > 0 ? (
            <div className="mt-2 overflow-x-auto surface">
              <table className="w-full text-sm">
                <caption className="p-3 text-left font-semibold">{t('finishedTitle')}</caption>
                <thead className="text-left text-xs text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 font-medium">{t('learner')}</th>
                    <th className="px-3 py-2 font-medium">{t('status')}</th>
                    <th className="px-3 py-2 font-medium">{t('score')}</th>
                    <th className="px-3 py-2 font-medium">{t('alerts')}</th>
                    <th className="px-3 py-2 font-medium">{t('integrity')}</th>
                    <th className="px-3 py-2 font-medium">{t('review')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {finished.map((s) => (
                    <tr key={s.id}>
                      <td className="px-3 py-2">{s.learner.name}</td>
                      <td className="px-3 py-2">{t(`sessionStatus.${s.status}`)}</td>
                      <td className="px-3 py-2 tabular-nums">{s.scorePercent === null ? '—' : `${s.scorePercent}%`}</td>
                      <td className="px-3 py-2 tabular-nums">{s.alertCount}</td>
                      <td className="px-3 py-2 tabular-nums">
                        <span className={s.integrity >= 80 ? 'text-success' : s.integrity >= 50 ? 'text-amber-700 dark:text-amber-300' : 'text-destructive'}>{s.integrity}/100</span>
                      </td>
                      <td className="px-3 py-2">
                        <Button size="sm" variant={s.review === 'PENDING' ? 'default' : 'outline'} onClick={() => setReviewFor(s)}>
                          <ClipboardCheck aria-hidden className="size-4" />
                          {s.review === 'PENDING' ? t('reviewNow') : tExam(`integrity.reviewStatus.${s.review}`)}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </section>

        <aside aria-label={t('feedTitle')} className="flex max-h-[80vh] flex-col gap-2 surface p-3 xl:sticky xl:top-20">
          <h2 className="font-semibold">{t('feedTitle')}</h2>
          {data.events.length === 0 ? <p className="text-sm text-muted-foreground">{t('feedEmpty')}</p> : null}
          <ol className="flex flex-col gap-1.5 overflow-y-auto" aria-live="polite">
            {data.events.map((event) => {
              const alert = ALERT_EVENT_KINDS.includes(event.kind) || event.kind === 'WARNING_DISPUTED';
              const who = byId.get(event.sessionId)?.learner.name ?? '';
              const detail = eventDetail(event, tExam);
              return (
                <li key={event.id} className={`rounded-lg px-2.5 py-1.5 text-sm ${alert ? 'bg-destructive/10 text-destructive' : 'bg-muted'}`}>
                  <span className="font-medium">{who}</span> · {t(`event.${event.kind}`)}
                  {detail ? <span className="block text-xs opacity-80">“{detail}”</span> : null}
                  <span className="flex items-center justify-between gap-2 text-xs opacity-70">
                    {format.dateTime(new Date(event.at), { timeStyle: 'medium' })}
                    {event.snapshot ? (
                      <button type="button" onClick={() => setSnapshotId(event.id)} className="flex items-center gap-1 underline underline-offset-2">
                        <ImageIcon aria-hidden className="size-3.5" />
                        {tExam('integrity.viewSnapshot')}
                      </button>
                    ) : null}
                  </span>
                </li>
              );
            })}
          </ol>
        </aside>
      </div>

      <WarnDialog session={warnFor} onClose={() => setWarnFor(null)} onDone={load} />
      <EndDialog session={endFor} onClose={() => setEndFor(null)} onDone={load} />
      <MessageDialog lessonId={lessonId} target={messageFor} onClose={() => setMessageFor(null)} />
      <ReviewDialog session={reviewFor} onClose={() => setReviewFor(null)} onDone={load} onSnapshot={setSnapshotId} />
      <SnapshotDialog eventId={snapshotId} onClose={() => setSnapshotId(null)} />
    </div>
  );
}

function LearnerTile({
  session,
  flag,
  maxWarnings,
  questionCount,
  onMessage,
  stream,
  proctored,
  left,
  focused,
  onFocus,
  onWarn,
  onEnd,
}: {
  session: ProctorSession;
  flag: ProctorEventView | null;
  maxWarnings: number;
  questionCount: number;
  onMessage: () => void;
  stream: MediaStream | null;
  proctored: boolean;
  left: number;
  focused: boolean;
  onFocus: () => void;
  onWarn: () => void;
  onEnd: () => void;
}) {
  const t = useTranslations('Proctor');
  const video = useRef<HTMLVideoElement>(null);
  const progress = questionCount > 0 ? Math.round((Math.min(session.answered, questionCount) / questionCount) * 100) : 0;
  useEffect(() => {
    if (video.current && video.current.srcObject !== stream) video.current.srcObject = stream;
  }, [stream]);
  const problems = [
    !session.online && t('chip.offline'),
    proctored && !session.cameraOn && t('chip.cameraOff'),
    !session.fullscreen && t('chip.notFullscreen'),
    !session.tabVisible && t('chip.otherTab'),
  ].filter((p): p is string => !!p);

  return (
    <li className={`flex flex-col overflow-hidden rounded-2xl border bg-card ${problems.length ? 'border-destructive' : 'border-border'} ${focused ? 'sm:col-span-2 2xl:col-span-3' : ''}`}>
      <div className="relative aspect-video bg-black">
        {proctored ? (
          <video ref={video} autoPlay muted playsInline aria-label={t('cameraOf', { name: session.learner.name })} className="size-full object-contain" />
        ) : null}
        {proctored && !stream ? (
          <span className="absolute inset-0 grid place-items-center text-sm text-white/80">
            {session.online && session.cameraOn ? t('connecting') : <span className="flex items-center gap-2"><VideoOff aria-hidden className="size-5" />{t('noVideo')}</span>}
          </span>
        ) : null}
        <span className="absolute left-2 top-2 flex items-center gap-1.5 rounded-full bg-black/60 px-2 py-0.5 text-xs font-medium text-white">
          {stream ? <span className="size-2 animate-pulse rounded-full bg-red-500" aria-hidden /> : null}
          {stream ? t('live') : t('notLive')}
        </span>
        <button type="button" onClick={onFocus} aria-label={focused ? t('shrink') : t('enlarge')} className="absolute right-2 top-2 rounded-full bg-black/60 p-1.5 text-white hover:bg-black/80">
          {focused ? <Minimize2 aria-hidden className="size-4" /> : <Maximize2 aria-hidden className="size-4" />}
        </button>
      </div>
      <div className="flex flex-col gap-2 p-3">
        <div className="flex items-center justify-between gap-2">
          <span className="min-w-0 truncate font-medium">{session.learner.name}</span>
          <span className={`flex items-center gap-1 text-sm tabular-nums ${left <= 60 ? 'text-destructive' : 'text-muted-foreground'}`}>
            <Clock aria-hidden className="size-4" />
            {formatCountdown(left)}
          </span>
        </div>
        <div className="flex flex-wrap gap-1.5 text-xs">
          {problems.length === 0 ? (
            <span className="flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-green-900 dark:bg-green-900/30 dark:text-green-100"><Wifi aria-hidden className="size-3" />{t('chip.ok')}</span>
          ) : (
            problems.map((p) => (
              <span key={p} className="flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 text-destructive">
                {p === t('chip.offline') ? <WifiOff aria-hidden className="size-3" /> : p === t('chip.cameraOff') ? <VideoOff aria-hidden className="size-3" /> : <MonitorOff aria-hidden className="size-3" />}
                {p}
              </span>
            ))
          )}
          {session.unreadWarnings > 0 ? (
            <span className="flex items-center gap-1 rounded-full bg-destructive px-2 py-0.5 font-medium text-white">
              <AlertTriangle aria-hidden className="size-3" />
              {t('chip.warningUnread')}
            </span>
          ) : null}
          {flag ? (
            <span className="flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 font-medium text-destructive">
              <ScanFace aria-hidden className="size-3" />
              {t(`event.${flag.kind}`)}
            </span>
          ) : null}
          {maxWarnings > 0 || session.warningCount > 0 ? (
            <span className={`rounded-full px-2 py-0.5 tabular-nums ${session.warningCount ? 'bg-destructive/10 text-destructive' : 'bg-muted'}`}>
              {maxWarnings > 0 ? t('warningsOf', { count: session.warningCount, max: maxWarnings }) : t('warningsCount', { count: session.warningCount })}
            </span>
          ) : null}
          {session.alertCount > 0 ? (
            <span className="flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-amber-900 dark:bg-amber-900/30 dark:text-amber-100">
              <AlertTriangle aria-hidden className="size-3" />
              {t('alertCount', { count: session.alertCount })}
            </span>
          ) : null}
        </div>
        {questionCount > 0 ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted" aria-hidden>
              <span className="block h-full rounded-full bg-primary" style={{ width: `${progress}%` }} />
            </span>
            <span className="tabular-nums">{t('answered', { count: Math.min(session.answered, questionCount), total: questionCount })}</span>
          </div>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={onMessage}>
            <MessageSquare aria-hidden className="size-4" />
            {t('message')}
          </Button>
          <Button size="sm" variant="outline" onClick={onWarn}>
            <AlertTriangle aria-hidden className="size-4" />
            {t('warn')}
          </Button>
          <Button size="sm" variant="destructive" onClick={onEnd}>
            <Ban aria-hidden className="size-4" />
            {t('end')}
          </Button>
          {proctored && !stream && session.online ? <Video aria-hidden className="ml-auto size-4 animate-pulse text-muted-foreground" /> : null}
        </div>
      </div>
    </li>
  );
}

function WarnDialog({ session, onClose, onDone }: { session: ProctorSession | null; onClose: () => void; onDone: () => Promise<void> }) {
  const t = useTranslations('Proctor');
  const tCommon = useTranslations('Common');
  const [message, setMessage] = useState('');
  const [pending, setPending] = useState(false);
  const presets = [t('preset.lookAtScreen'), t('preset.stayInFrame'), t('preset.fullscreen'), t('preset.noOtherPeople')];
  useEffect(() => setMessage(''), [session]);

  const send = async () => {
    if (!session || !message.trim()) return;
    setPending(true);
    try {
      await api('POST', `instructor/exam-sessions/${session.id}/warn`, { message: message.trim() });
      toast.success(t('warned', { name: session.learner.name }));
      onClose();
      await onDone();
    } catch {
      toast.error(tCommon('genericError'));
    } finally {
      setPending(false);
    }
  };

  return (
    <Dialog open={!!session} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg" closeLabel={tCommon('close')} aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>{t('warnTitle', { name: session?.learner.name ?? '' })}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-wrap gap-2">
          {presets.map((preset) => (
            <button key={preset} type="button" onClick={() => setMessage(preset)} className="rounded-full border border-border px-3 py-1 text-xs hover:border-primary">
              {preset}
            </button>
          ))}
        </div>
        <Label htmlFor="warn-message">{t('warnMessage')}</Label>
        <Textarea id="warn-message" rows={3} maxLength={300} value={message} onChange={(e) => setMessage(e.target.value)} />
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{tCommon('cancel')}</Button>
          <Button disabled={pending || !message.trim()} onClick={() => void send()}>{pending ? tCommon('saving') : t('sendWarning')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EndDialog({ session, onClose, onDone }: { session: ProctorSession | null; onClose: () => void; onDone: () => Promise<void> }) {
  const t = useTranslations('Proctor');
  const tCommon = useTranslations('Common');
  const [reason, setReason] = useState('');
  const [pending, setPending] = useState(false);
  useEffect(() => setReason(''), [session]);

  const end = async () => {
    if (!session || !reason.trim()) return;
    setPending(true);
    try {
      await api('POST', `instructor/exam-sessions/${session.id}/terminate`, { reason: reason.trim() });
      toast.success(t('ended', { name: session.learner.name }));
      onClose();
      await onDone();
    } catch {
      toast.error(tCommon('genericError'));
    } finally {
      setPending(false);
    }
  };

  return (
    <Dialog open={!!session} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg" closeLabel={tCommon('close')} aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>{t('endTitle', { name: session?.learner.name ?? '' })}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">{t('endBody')}</p>
        <Label htmlFor="end-reason" required>{t('endReason')}</Label>
        <Textarea id="end-reason" rows={3} maxLength={300} value={reason} onChange={(e) => setReason(e.target.value)} />
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{tCommon('cancel')}</Button>
          <Button variant="destructive" disabled={pending || !reason.trim()} onClick={() => void end()}>{pending ? tCommon('saving') : t('end')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MessageDialog({ lessonId, target, onClose }: { lessonId: string; target: ProctorSession | 'all' | null; onClose: () => void }) {
  const t = useTranslations('Proctor');
  const tCommon = useTranslations('Common');
  const [message, setMessage] = useState('');
  const [pending, setPending] = useState(false);
  useEffect(() => setMessage(''), [target]);

  const send = async () => {
    if (!target || !message.trim()) return;
    setPending(true);
    try {
      if (target === 'all') {
        const { sent } = await api<{ sent: number }>('POST', `instructor/exams/${lessonId}/notice`, { message: message.trim() });
        toast.success(t('messageSentAll', { count: sent }));
      } else {
        await api('POST', `instructor/exam-sessions/${target.id}/notice`, { message: message.trim() });
        toast.success(t('messageSent', { name: target.learner.name }));
      }
      onClose();
    } catch {
      toast.error(tCommon('genericError'));
    } finally {
      setPending(false);
    }
  };

  return (
    <Dialog open={!!target} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg" closeLabel={tCommon('close')} aria-describedby="message-hint">
        <DialogHeader>
          <DialogTitle>{target === 'all' ? t('messageAllTitle') : t('messageTitle', { name: target?.learner.name ?? '' })}</DialogTitle>
        </DialogHeader>
        <p id="message-hint" className="text-sm text-muted-foreground">{t('messageHint')}</p>
        <Label htmlFor="notice-message">{t('messageLabel')}</Label>
        <Textarea id="notice-message" rows={3} maxLength={300} value={message} onChange={(e) => setMessage(e.target.value)} />
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{tCommon('cancel')}</Button>
          <Button disabled={pending || !message.trim()} onClick={() => void send()}>{pending ? tCommon('saving') : t('sendMessage')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ReviewDialog({
  session,
  onClose,
  onDone,
  onSnapshot,
}: {
  session: ProctorSession | null;
  onClose: () => void;
  onDone: () => Promise<void>;
  onSnapshot: (eventId: string) => void;
}) {
  const t = useTranslations('Proctor');
  const tCommon = useTranslations('Common');
  const [report, setReport] = useState<ExamReport | null>(null);
  const [status, setStatus] = useState<'CLEARED' | 'FLAGGED'>('CLEARED');
  const [note, setNote] = useState('');
  const [pending, setPending] = useState(false);

  useEffect(() => {
    setReport(null);
    if (!session) return;
    let cancelled = false;
    api('GET', `instructor/exam-sessions/${session.id}/report`)
      .then((raw) => {
        if (cancelled) return;
        const next = ExamReportSchema.parse(raw);
        setReport(next);
        setStatus(next.review.status === 'FLAGGED' ? 'FLAGGED' : 'CLEARED');
        setNote(next.review.note ?? '');
      })
      .catch(() => toast.error(tCommon('genericError')));
    return () => {
      cancelled = true;
    };
  }, [session, tCommon]);

  const save = async () => {
    if (!session) return;
    setPending(true);
    try {
      setReport(ExamReportSchema.parse(await api('POST', `instructor/exam-sessions/${session.id}/review`, { status, note: note.trim() || undefined })));
      toast.success(t('reviewSaved'));
      onClose();
      await onDone();
    } catch (e) {
      toast.error(e instanceof ApiClientError && e.body?.code === 'NOTE_REQUIRED' ? t('reviewNoteRequired') : tCommon('genericError'));
    } finally {
      setPending(false);
    }
  };

  return (
    <Dialog open={!!session} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto" closeLabel={tCommon('close')} aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>{t('reviewTitle', { name: session?.learner.name ?? '' })}</DialogTitle>
        </DialogHeader>
        {!report ? (
          <p role="status">{tCommon('loading')}</p>
        ) : (
          <>
            {report.terminatedReason ? <p className="text-sm">{t('endedBecause', { reason: report.terminatedReason })}</p> : null}
            <IntegrityReportView report={report} onSnapshot={onSnapshot} />
            <fieldset className="flex flex-col gap-2 border-t border-border pt-4">
              <legend className="mb-2 font-semibold">{t('decision')}</legend>
              {(['CLEARED', 'FLAGGED'] as const).map((value) => (
                <label key={value} className="flex items-start gap-3 text-sm">
                  <input type="radio" name="review-status" className="mt-0.5 size-4 accent-[var(--primary)]" checked={status === value} onChange={() => setStatus(value)} />
                  <span>
                    <span className="font-medium">{t(`decisionOption.${value}`)}</span>
                    <span className="block text-xs text-muted-foreground">{t(`decisionHint.${value}`)}</span>
                  </span>
                </label>
              ))}
              <Label htmlFor="review-note" required={status === 'FLAGGED'} className="mt-2">{t('reviewNote')}</Label>
              <Textarea id="review-note" rows={3} maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} />
            </fieldset>
          </>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{tCommon('cancel')}</Button>
          <Button disabled={pending || !report || (status === 'FLAGGED' && !note.trim())} onClick={() => void save()}>
            {pending ? tCommon('saving') : t('saveReview')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SnapshotDialog({ eventId, onClose }: { eventId: string | null; onClose: () => void }) {
  const t = useTranslations('Proctor');
  const tCommon = useTranslations('Common');
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    setUrl(null);
    setFailed(false);
    if (!eventId) return;
    let cancelled = false;
    api<{ dataUrl: string }>('GET', `instructor/proctor-events/${eventId}/snapshot`)
      .then((r) => !cancelled && setUrl(r.dataUrl))
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [eventId]);
  return (
    <Dialog open={!!eventId} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-xl" closeLabel={tCommon('close')} aria-describedby="snapshot-hint">
        <DialogHeader>
          <DialogTitle>{t('snapshotTitle')}</DialogTitle>
        </DialogHeader>
        <p id="snapshot-hint" className="text-sm text-muted-foreground">{t('snapshotHint')}</p>
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element -- a data URL, nothing to optimise
          <img src={url} alt={t('snapshotAlt')} className="w-full rounded-xl bg-black" />
        ) : failed ? (
          <p role="alert" className="text-sm text-destructive">{tCommon('genericError')}</p>
        ) : (
          <p role="status">{tCommon('loading')}</p>
        )}
      </DialogContent>
    </Dialog>
  );
}
