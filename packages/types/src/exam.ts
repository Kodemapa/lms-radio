import { z } from 'zod';

/** Exam settings on a QUIZ lesson. null on the lesson = an ordinary practice quiz. */
export const ExamSettingsSchema = z
  .object({
    /** ISO date-time; null = can start any time. */
    opensAt: z.string().datetime().nullable(),
    /** ISO date-time; null = never closes. */
    closesAt: z.string().datetime().nullable(),
    /** Minutes allowed once started. */
    durationMin: z.number().int().min(1).max(600),
    /** Live camera proctoring for the whole exam. */
    proctored: z.boolean(),
    /** Proctored only: face / phone / voice / second-screen checks in the learner's browser. */
    aiMonitoring: z.boolean().default(false),
    /** Serious alerts (tab switch, another person, phone, …) count as warnings automatically. */
    autoWarn: z.boolean().default(false),
    /** Reaching this many warnings ends the exam and submits it. 0 = no limit. */
    maxWarnings: z.number().int().min(0).max(10).default(0),
  })
  .refine((e) => !e.opensAt || !e.closesAt || new Date(e.closesAt) > new Date(e.opensAt), {
    message: 'The exam must close after it opens',
    path: ['closesAt'],
  });
export type ExamSettings = z.infer<typeof ExamSettingsSchema>;

export const EXAM_SESSION_STATUSES = ['IN_PROGRESS', 'SUBMITTED', 'TERMINATED', 'EXPIRED'] as const;
export type ExamSessionStatus = (typeof EXAM_SESSION_STATUSES)[number];

export const EXAM_REVIEW_STATUSES = ['PENDING', 'CLEARED', 'FLAGGED'] as const;
export type ExamReviewStatus = (typeof EXAM_REVIEW_STATUSES)[number];

export const PROCTOR_EVENT_KINDS = [
  'STARTED',
  'RESUMED',
  'CAMERA_ON',
  'CAMERA_OFF',
  'TAB_HIDDEN',
  'TAB_VISIBLE',
  'WINDOW_BLUR',
  'FULLSCREEN_EXIT',
  'FULLSCREEN_ENTER',
  'COPY_PASTE',
  'CONNECTION_LOST',
  'WARNING',
  /** The learner read a warning and clicked to continue. */
  'WARNING_ACKNOWLEDGED',
  /** The learner disputes a warning (with a note). */
  'WARNING_DISPUTED',
  /** A non-blocking message from a proctor. */
  'NOTICE',
  /** Browser AI checks. */
  'NO_FACE',
  'MULTIPLE_FACES',
  'LOOKING_AWAY',
  'PROHIBITED_OBJECT',
  'VOICE_DETECTED',
  'SECOND_SCREEN',
  'TERMINATED',
  'SUBMITTED',
  'EXPIRED',
  /** A proctor reviewed the sitting. */
  'REVIEWED',
] as const;
export type ProctorEventKind = (typeof PROCTOR_EVENT_KINDS)[number];

/** Events the learner's browser may report (the rest come from the server or a proctor). */
export const LEARNER_EVENT_KINDS = [
  'CAMERA_ON',
  'CAMERA_OFF',
  'TAB_HIDDEN',
  'TAB_VISIBLE',
  'WINDOW_BLUR',
  'FULLSCREEN_EXIT',
  'FULLSCREEN_ENTER',
  'COPY_PASTE',
  'WARNING_ACKNOWLEDGED',
  'WARNING_DISPUTED',
  'NO_FACE',
  'MULTIPLE_FACES',
  'LOOKING_AWAY',
  'PROHIBITED_OBJECT',
  'VOICE_DETECTED',
  'SECOND_SCREEN',
] as const;
export type LearnerEventKind = (typeof LEARNER_EVENT_KINDS)[number];

/** Alerts proctors should notice (shown highlighted). */
export const ALERT_EVENT_KINDS: readonly ProctorEventKind[] = [
  'CAMERA_OFF',
  'TAB_HIDDEN',
  'WINDOW_BLUR',
  'FULLSCREEN_EXIT',
  'COPY_PASTE',
  'CONNECTION_LOST',
  'NO_FACE',
  'MULTIPLE_FACES',
  'LOOKING_AWAY',
  'PROHIBITED_OBJECT',
  'VOICE_DETECTED',
  'SECOND_SCREEN',
];

/** Browser AI checks; these may carry an evidence snapshot. */
export const AI_EVENT_KINDS: readonly LearnerEventKind[] = [
  'NO_FACE',
  'MULTIPLE_FACES',
  'LOOKING_AWAY',
  'PROHIBITED_OBJECT',
  'VOICE_DETECTED',
  'SECOND_SCREEN',
];

/**
 * Alerts that count as a warning automatically when the exam has "automatic warnings"
 * on. Looking away and voices are only noted for the proctor (too many false alarms).
 */
export const AUTO_WARN_KINDS: readonly LearnerEventKind[] = [
  'TAB_HIDDEN',
  'NO_FACE',
  'MULTIPLE_FACES',
  'PROHIBITED_OBJECT',
  'SECOND_SCREEN',
];

/** Points taken off the integrity score (out of 100) for each alert of a kind. */
export const INTEGRITY_PENALTY: Partial<Record<ProctorEventKind, number>> = {
  WARNING: 10,
  MULTIPLE_FACES: 10,
  PROHIBITED_OBJECT: 10,
  SECOND_SCREEN: 10,
  TAB_HIDDEN: 5,
  NO_FACE: 5,
  CAMERA_OFF: 5,
  FULLSCREEN_EXIT: 3,
  COPY_PASTE: 3,
  LOOKING_AWAY: 2,
  VOICE_DETECTED: 2,
  WINDOW_BLUR: 1,
};

export type IntegrityRisk = 'LOW' | 'MEDIUM' | 'HIGH';

/**
 * Integrity score: 100 minus a penalty per alert (automatic warnings aren't counted
 * twice: the alert that caused them already was). A guide for the proctor's review,
 * never a verdict on its own.
 */
export function integrityScore(events: readonly { kind: ProctorEventKind; auto?: boolean }[]): { score: number; risk: IntegrityRisk } {
  const counts: Partial<Record<ProctorEventKind, number>> = {};
  let autoWarnings = 0;
  for (const event of events) {
    counts[event.kind] = (counts[event.kind] ?? 0) + 1;
    if (event.kind === 'WARNING' && event.auto) autoWarnings += 1;
  }
  return integrityFromCounts(counts, autoWarnings);
}

/** The same score from event counts per kind (`autoWarnings` of the WARNINGs were automatic). */
export function integrityFromCounts(
  counts: Partial<Record<ProctorEventKind, number>>,
  autoWarnings = 0,
): { score: number; risk: IntegrityRisk } {
  let penalty = -autoWarnings * (INTEGRITY_PENALTY.WARNING ?? 0);
  for (const [kind, count] of Object.entries(counts) as [ProctorEventKind, number][]) {
    penalty += (INTEGRITY_PENALTY[kind] ?? 0) * count;
  }
  const score = Math.min(100, Math.max(0, 100 - penalty));
  return { score, risk: score >= 80 ? 'LOW' : score >= 50 ? 'MEDIUM' : 'HIGH' };
}

export const IceServerSchema = z.object({
  urls: z.union([z.string(), z.array(z.string())]),
  username: z.string().optional(),
  credential: z.string().optional(),
});
export type IceServer = z.infer<typeof IceServerSchema>;

export const ExamWarningSchema = z.object({
  id: z.string().uuid(),
  message: z.string(),
  at: z.string(),
  /** The learner clicked "I understand" on it; until then their exam screen is blanked. */
  acknowledged: z.boolean().default(false),
  /** Automatic warning: the alert that caused it (the page shows a translated message). */
  code: z.enum(PROCTOR_EVENT_KINDS).nullable().default(null),
  /** The learner disputed it. */
  disputed: z.boolean().default(false),
});
export type ExamWarning = z.infer<typeof ExamWarningSchema>;

/** A non-blocking message from a proctor. */
export const ExamNoticeSchema = z.object({ id: z.string().uuid(), message: z.string(), at: z.string() });

/** The learner's own sitting, as the exam page sees it. */
export const ExamSessionPublicSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(EXAM_SESSION_STATUSES),
  startedAt: z.string(),
  endsAt: z.string(),
  submittedAt: z.string().nullable(),
  terminatedReason: z.string().nullable(),
  warnings: z.array(ExamWarningSchema),
  notices: z.array(ExamNoticeSchema).default([]),
});
export type ExamSessionPublic = z.infer<typeof ExamSessionPublicSchema>;

/** Exam block on the learner's lesson page. */
export const PlayerExamSchema = z.object({
  opensAt: z.string().nullable(),
  closesAt: z.string().nullable(),
  durationMin: z.number().int(),
  proctored: z.boolean(),
  aiMonitoring: z.boolean().default(false),
  /** 0 = no limit. */
  maxWarnings: z.number().int().default(0),
  /** Server clock, so the countdown doesn't depend on the learner's clock. */
  serverNow: z.string(),
  session: ExamSessionPublicSchema.nullable(),
  iceServers: z.array(IceServerSchema),
});
export type PlayerExam = z.infer<typeof PlayerExamSchema>;

export const ExamHeartbeatSchema = z.object({
  camera: z.boolean(),
  fullscreen: z.boolean(),
  visible: z.boolean(),
  /** Random id per page load; a new one tells proctors to reconnect the video. */
  epoch: z.string().min(8).max(64),
  /** Questions answered so far. */
  answered: z.number().int().min(0).max(1000).optional(),
});
export type ExamHeartbeat = z.infer<typeof ExamHeartbeatSchema>;

/** Live connection setup: a proctor's offer for one learner, or the learner's answer. */
export const ProctorOfferSchema = z.object({ peerId: z.string().min(8).max(64), sdp: z.string().min(10).max(100_000) });
export type ProctorOffer = z.infer<typeof ProctorOfferSchema>;
export const ProctorAnswerSchema = z.object({ sessionId: z.string().uuid(), peerId: z.string(), sdp: z.string() });
export type ProctorAnswer = z.infer<typeof ProctorAnswerSchema>;

export const ProctorEventSchema = z.object({
  id: z.string().uuid(),
  sessionId: z.string().uuid(),
  kind: z.enum(PROCTOR_EVENT_KINDS),
  data: z.record(z.unknown()),
  at: z.string(),
  /** An evidence snapshot can be fetched for it. */
  snapshot: z.boolean().default(false),
});
export type ProctorEventView = z.infer<typeof ProctorEventSchema>;

/** One learner on the proctor dashboard. */
export const ProctorSessionSchema = z.object({
  id: z.string().uuid(),
  learner: z.object({ id: z.string().uuid(), name: z.string(), email: z.string().nullable() }),
  status: z.enum(EXAM_SESSION_STATUSES),
  startedAt: z.string(),
  endsAt: z.string(),
  submittedAt: z.string().nullable(),
  /** Heard from in the last 15 seconds. */
  online: z.boolean(),
  cameraOn: z.boolean(),
  fullscreen: z.boolean(),
  tabVisible: z.boolean(),
  streamEpoch: z.string().nullable(),
  alertCount: z.number().int(),
  /** Warnings sent but not yet read: the learner's screen shows only the warning. */
  unreadWarnings: z.number().int().default(0),
  warningCount: z.number().int().default(0),
  answered: z.number().int().default(0),
  integrity: z.number().int().default(100),
  review: z.enum(EXAM_REVIEW_STATUSES).default('PENDING'),
  scorePercent: z.number().int().nullable(),
});
export type ProctorSession = z.infer<typeof ProctorSessionSchema>;

export const ProctorDashboardSchema = z.object({
  lesson: z.object({
    id: z.string().uuid(),
    title: z.string(),
    courseId: z.string().uuid(),
    courseTitle: z.string(),
    opensAt: z.string().nullable(),
    closesAt: z.string().nullable(),
    durationMin: z.number().int(),
    proctored: z.boolean(),
    aiMonitoring: z.boolean().default(false),
    autoWarn: z.boolean().default(false),
    maxWarnings: z.number().int().default(0),
    questionCount: z.number().int().default(0),
  }),
  serverNow: z.string(),
  enrolledCount: z.number().int(),
  sessions: z.array(ProctorSessionSchema),
  /** Newest first, last 200. */
  events: z.array(ProctorEventSchema),
  iceServers: z.array(IceServerSchema),
});
export type ProctorDashboard = z.infer<typeof ProctorDashboardSchema>;

/** One sitting's integrity report: for the proctor's review and (without evidence) the learner. */
export const ExamReportSchema = z.object({
  sessionId: z.string().uuid(),
  lessonTitle: z.string(),
  learner: z.object({ id: z.string().uuid(), name: z.string(), email: z.string().nullable() }),
  status: z.enum(EXAM_SESSION_STATUSES),
  startedAt: z.string(),
  endsAt: z.string(),
  submittedAt: z.string().nullable(),
  terminatedReason: z.string().nullable(),
  scorePercent: z.number().int().nullable(),
  integrity: z.object({ score: z.number().int(), risk: z.enum(['LOW', 'MEDIUM', 'HIGH']) }),
  warningCount: z.number().int(),
  maxWarnings: z.number().int(),
  alertCount: z.number().int(),
  review: z.object({
    status: z.enum(EXAM_REVIEW_STATUSES),
    note: z.string().nullable(),
    reviewer: z.string().nullable(),
    at: z.string().nullable(),
  }),
  /** Oldest first. */
  events: z.array(ProctorEventSchema),
});
export type ExamReport = z.infer<typeof ExamReportSchema>;

export const ExamReviewInputSchema = z.object({
  status: z.enum(['CLEARED', 'FLAGGED']),
  note: z.string().trim().max(1000).optional(),
});
export type ExamReviewInput = z.infer<typeof ExamReviewInputSchema>;

/** Where an exam stands for the learner (dashboard). */
export const MY_EXAM_STATES = ['IN_PROGRESS', 'LIVE', 'UPCOMING', 'FINISHED', 'MISSED'] as const;
export type MyExamState = (typeof MY_EXAM_STATES)[number];

/** One exam on the learner's dashboard. */
export const MyExamSchema = z.object({
  lessonId: z.string().uuid(),
  title: z.string(),
  course: z.object({ id: z.string().uuid(), slug: z.string(), title: z.string() }),
  state: z.enum(MY_EXAM_STATES),
  opensAt: z.string().nullable(),
  closesAt: z.string().nullable(),
  durationMin: z.number().int(),
  questionCount: z.number().int(),
  proctored: z.boolean(),
  aiMonitoring: z.boolean(),
  maxWarnings: z.number().int(),
  /** IN_PROGRESS: when my sitting ends. */
  endsAt: z.string().nullable(),
  /** FINISHED: my result and the proctor's review. */
  submittedAt: z.string().nullable(),
  scorePercent: z.number().int().nullable(),
  passed: z.boolean().nullable(),
  sessionStatus: z.enum(EXAM_SESSION_STATUSES).nullable(),
  review: z.enum(EXAM_REVIEW_STATUSES).nullable(),
});
export type MyExam = z.infer<typeof MyExamSchema>;

export const MyExamsSchema = z.object({ serverNow: z.string(), exams: z.array(MyExamSchema) });
export type MyExams = z.infer<typeof MyExamsSchema>;

/** Seconds left until `endsAt`, given the server/client clock offset (ms, server − client). */
export function secondsLeft(endsAt: string, offsetMs: number, now = Date.now()): number {
  return Math.max(0, Math.floor((new Date(endsAt).getTime() - (now + offsetMs)) / 1000));
}

/** "1:05:09" / "4:07" for a countdown. */
export function formatCountdown(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`;
}

/** Whether an exam can be started at `now`. */
export function examWindowState(
  exam: { opensAt: string | Date | null; closesAt: string | Date | null },
  now: Date,
): 'NOT_OPEN' | 'OPEN' | 'CLOSED' {
  if (exam.opensAt && now < new Date(exam.opensAt)) return 'NOT_OPEN';
  if (exam.closesAt && now >= new Date(exam.closesAt)) return 'CLOSED';
  return 'OPEN';
}
