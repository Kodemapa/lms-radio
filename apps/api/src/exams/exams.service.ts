import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import {
  AI_EVENT_KINDS,
  ALERT_EVENT_KINDS,
  AUTO_WARN_KINDS,
  examWindowState,
  integrityFromCounts,
  type ExamHeartbeat,
  type ExamReport,
  type ExamReviewInput,
  type ExamSessionPublic,
  type LearnerEventKind,
  type MyExam,
  type MyExams,
  type PlayerExam,
  type ProctorDashboard,
  type ProctorEventKind,
} from '@obgyn/types';
import { type ExamSession, type Lesson, type Prisma, type ProctorEvent } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { type AuthUser } from '../auth/auth-user';
import { AppConfigService } from '../config/app-config.service';
import { AccessService } from '../courses/access.service';
import { CoursePermissions } from '../courses/course-permissions';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { SignalHub } from './signal-hub';

/** A submission may arrive this long after the deadline (network, auto-submit at 0:00). */
export const SUBMIT_GRACE_MS = 60_000;
/** A learner is "online" when their page reported within this time. */
const ONLINE_MS = 15_000;
/** The same alert from one learner is recorded at most once in this window. */
const EVENT_DEDUPE_MS = 3_000;
/** An automatic warning for the same kind of alert at most once in this window. */
export const AUTO_WARN_COOLDOWN_MS = 60_000;
/** Evidence snapshots: small JPEGs only. */
const SNAPSHOT_MAX_BYTES = 64 * 1024;
const SNAPSHOT_PREFIX = 'data:image/jpeg;base64,';

/** Text stored with automatic warnings (the learner's page shows a translated version by `code`). */
const AUTO_WARNING_TEXT: Partial<Record<ProctorEventKind, string>> = {
  TAB_HIDDEN: 'You left the exam tab. Stay on this tab until you submit.',
  NO_FACE: 'Your face was not visible. Stay in front of the camera.',
  MULTIPLE_FACES: 'Another person was seen on your camera. You must be alone.',
  PROHIBITED_OBJECT: 'A phone or book was seen on your camera. Put it away.',
  SECOND_SCREEN: 'A second screen was found. Disconnect it.',
};

/** What the learner's page may send with an event. */
export interface LearnerEventInput {
  kind: LearnerEventKind;
  /** WARNING_ACKNOWLEDGED / WARNING_DISPUTED */
  warningId?: string;
  /** WARNING_DISPUTED: why the learner disagrees. */
  note?: string;
  /** PROHIBITED_OBJECT: what was seen. */
  object?: string;
  /** AI alerts: a small JPEG data URL from the camera at that moment. */
  snapshot?: string;
}

type ExamLesson = Pick<
  Lesson,
  | 'id'
  | 'kind'
  | 'courseId'
  | 'examMode'
  | 'examOpensAt'
  | 'examClosesAt'
  | 'examDurationMin'
  | 'examProctored'
  | 'examAiMonitoring'
  | 'examMaxWarnings'
>;

const SESSION_WITH_COURSE = {
  lesson: { select: { id: true, courseId: true, course: { select: { id: true, instructorId: true } } } },
} satisfies Prisma.ExamSessionInclude;

function warningIdOf(data: Prisma.JsonValue): string | undefined {
  const id = (data as { warningId?: unknown } | null)?.warningId;
  return typeof id === 'string' ? id : undefined;
}

function field(data: Prisma.JsonValue, key: string): unknown {
  return data && typeof data === 'object' && !Array.isArray(data) ? (data as Record<string, unknown>)[key] : undefined;
}

/**
 * Timed, optionally proctored exams on quiz lessons: one sitting per learner, questions
 * hidden until it starts, a fixed deadline, live alerts for proctors, and the live
 * camera connection (set up through SignalHub; the video is never stored).
 */
@Injectable()
export class ExamsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
    private readonly permissions: CoursePermissions,
    private readonly config: AppConfigService,
    private readonly audit: AuditService,
    private readonly hub: SignalHub,
    private readonly storage: StorageService,
  ) {}

  static isExam(lesson: Pick<Lesson, 'kind' | 'examMode'>): boolean {
    return lesson.kind === 'QUIZ' && lesson.examMode;
  }

  // ---- Learner ------------------------------------------------------------------

  /** The exam block of the lesson page; null for ordinary lessons. */
  async playerExam(user: AuthUser, lesson: ExamLesson): Promise<PlayerExam | null> {
    if (!ExamsService.isExam(lesson)) return null;
    const session = await this.settle(
      await this.prisma.examSession.findUnique({ where: { userId_lessonId: { userId: user.userId, lessonId: lesson.id } } }),
    );
    return {
      opensAt: lesson.examOpensAt?.toISOString() ?? null,
      closesAt: lesson.examClosesAt?.toISOString() ?? null,
      durationMin: lesson.examDurationMin ?? 60,
      proctored: lesson.examProctored,
      aiMonitoring: lesson.examProctored && lesson.examAiMonitoring,
      maxWarnings: lesson.examMaxWarnings,
      serverNow: new Date().toISOString(),
      session: session ? await this.toPublic(session) : null,
      iceServers: this.config.get('PROCTOR_ICE_SERVERS'),
    };
  }

  /** My exams across every course I'm enrolled in (dashboard): live first, then upcoming, then past. */
  async myExams(user: AuthUser): Promise<MyExams> {
    const enrollments = await this.prisma.enrollment.findMany({ where: { userId: user.userId }, select: { courseId: true } });
    const courseIds = enrollments.map((e) => e.courseId);
    const now = new Date();
    if (courseIds.length === 0) return { serverNow: now.toISOString(), exams: [] };
    const lessons = await this.prisma.lesson.findMany({
      where: { courseId: { in: courseIds }, kind: 'QUIZ', examMode: true, deletedAt: null },
      include: { course: { select: { id: true, slug: true, title: true } } },
    });
    if (lessons.length === 0) return { serverNow: now.toISOString(), exams: [] };
    const ids = lessons.map((l) => l.id);
    const [counts, rows] = await Promise.all([
      this.prisma.quizQuestion.groupBy({ by: ['lessonId'], where: { lessonId: { in: ids }, atSec: null }, _count: { _all: true } }),
      this.prisma.examSession.findMany({ where: { userId: user.userId, lessonId: { in: ids } } }),
    ]);
    const sessions = await Promise.all(rows.map((row) => this.settle(row)));
    const attempts = await this.prisma.quizAttempt.findMany({
      where: { id: { in: sessions.map((s) => s.quizAttemptId).filter((id): id is string => !!id) } },
      select: { id: true, scorePercent: true, passed: true },
    });
    const questionCount = new Map(counts.map((c) => [c.lessonId, c._count._all]));
    const sessionOf = new Map(sessions.map((s) => [s.lessonId, s]));
    const attemptOf = new Map(attempts.map((a) => [a.id, a]));
    const order: Record<MyExam['state'], number> = { IN_PROGRESS: 0, LIVE: 1, UPCOMING: 2, FINISHED: 3, MISSED: 4 };

    const exams = lessons
      .filter((lesson) => (questionCount.get(lesson.id) ?? 0) > 0)
      .map((lesson): MyExam => {
        const session = sessionOf.get(lesson.id) ?? null;
        const attempt = session?.quizAttemptId ? attemptOf.get(session.quizAttemptId) : undefined;
        const window = examWindowState({ opensAt: lesson.examOpensAt, closesAt: lesson.examClosesAt }, now);
        const state: MyExam['state'] = session
          ? session.status === 'IN_PROGRESS' ? 'IN_PROGRESS' : 'FINISHED'
          : window === 'OPEN' ? 'LIVE' : window === 'NOT_OPEN' ? 'UPCOMING' : 'MISSED';
        return {
          lessonId: lesson.id,
          title: lesson.title,
          course: lesson.course,
          state,
          opensAt: lesson.examOpensAt?.toISOString() ?? null,
          closesAt: lesson.examClosesAt?.toISOString() ?? null,
          durationMin: lesson.examDurationMin ?? 60,
          questionCount: questionCount.get(lesson.id) ?? 0,
          proctored: lesson.examProctored,
          aiMonitoring: lesson.examProctored && lesson.examAiMonitoring,
          maxWarnings: lesson.examMaxWarnings,
          endsAt: session?.status === 'IN_PROGRESS' ? session.endsAt.toISOString() : null,
          submittedAt: session?.submittedAt?.toISOString() ?? null,
          scorePercent: attempt?.scorePercent ?? null,
          passed: attempt?.passed ?? null,
          sessionStatus: session?.status ?? null,
          review: session && session.status !== 'IN_PROGRESS' ? session.reviewStatus : null,
        };
      })
      .sort((a, b) => {
        const byState = order[a.state] - order[b.state];
        if (byState) return byState;
        const time = (e: MyExam) => new Date(e.state === 'UPCOMING' ? (e.opensAt ?? 0) : (e.submittedAt ?? e.closesAt ?? 0)).getTime();
        return a.state === 'UPCOMING' ? time(a) - time(b) : time(b) - time(a);
      });
    return { serverNow: now.toISOString(), exams };
  }

  /** Exam questions are shown only while the learner's sitting is running (staff always see them). */
  async questionsVisible(user: AuthUser, lesson: ExamLesson, manager: boolean): Promise<boolean> {
    if (!ExamsService.isExam(lesson) || manager) return true;
    const session = await this.settle(
      await this.prisma.examSession.findUnique({ where: { userId_lessonId: { userId: user.userId, lessonId: lesson.id } } }),
    );
    return session?.status === 'IN_PROGRESS';
  }

  /** Start the exam, or resume a running sitting (e.g. after a reload). */
  async start(user: AuthUser, lessonId: string): Promise<PlayerExam> {
    const { lesson, enrolled, manager } = await this.access.getAccessibleLesson(user, lessonId);
    if (!ExamsService.isExam(lesson)) throw new BadRequestException('Not an exam');
    if (!enrolled && !manager) throw new ForbiddenException({ code: 'NOT_ENROLLED' });
    const existing = await this.settle(
      await this.prisma.examSession.findUnique({ where: { userId_lessonId: { userId: user.userId, lessonId } } }),
    );
    if (existing) {
      if (existing.status !== 'IN_PROGRESS') throw new ConflictException({ code: 'EXAM_FINISHED' });
      await this.record(existing.id, 'RESUMED');
    } else {
      const now = new Date();
      const window = examWindowState({ opensAt: lesson.examOpensAt, closesAt: lesson.examClosesAt }, now);
      if (window === 'NOT_OPEN') throw new ConflictException({ code: 'EXAM_NOT_OPEN', message: 'This exam has not opened yet' });
      if (window === 'CLOSED') throw new ConflictException({ code: 'EXAM_CLOSED', message: 'This exam has closed' });
      const questions = await this.prisma.quizQuestion.count({ where: { lessonId, atSec: null } });
      if (questions === 0) throw new ConflictException({ code: 'QUIZ_EMPTY' });
      const endsAt = new Date(now.getTime() + (lesson.examDurationMin ?? 60) * 60_000);
      try {
        const created = await this.prisma.examSession.create({ data: { lessonId, userId: user.userId, endsAt, startedAt: now } });
        await this.record(created.id, 'STARTED');
      } catch (error) {
        // Two tabs pressing Start at once: the other one won.
        if ((error as { code?: string }).code !== 'P2002') throw error;
      }
    }
    return (await this.playerExam(user, lesson))!;
  }

  /** The exam page reports every few seconds; the reply carries warnings and whether it was ended. */
  async heartbeat(user: AuthUser, sessionId: string, dto: ExamHeartbeat): Promise<ExamSessionPublic & { serverNow: string }> {
    let session = await this.ownSession(user, sessionId);
    if (session.status === 'IN_PROGRESS') {
      session = await this.prisma.examSession.update({
        where: { id: session.id },
        data: {
          lastSeenAt: new Date(),
          cameraOn: dto.camera,
          fullscreen: dto.fullscreen,
          tabVisible: dto.visible,
          streamEpoch: dto.epoch,
          ...(dto.answered === undefined ? {} : { answeredCount: dto.answered }),
        },
      });
    }
    return { ...(await this.toPublic(session)), serverNow: new Date().toISOString() };
  }

  /** Something a proctor should know about (tab switch, camera off, another person, …). */
  async learnerEvent(user: AuthUser, sessionId: string, input: LearnerEventInput): Promise<void> {
    const { kind } = input;
    const session = await this.ownSession(user, sessionId);
    if (session.status !== 'IN_PROGRESS') return;
    if (kind === 'WARNING_ACKNOWLEDGED' || kind === 'WARNING_DISPUTED') {
      // Must name one of this sitting's warnings; each is acknowledged (and disputed) once.
      if (!input.warningId) throw new BadRequestException('warningId is required');
      const note = input.note?.trim();
      if (kind === 'WARNING_DISPUTED' && !note) throw new BadRequestException('note is required');
      const warning = await this.prisma.proctorEvent.findFirst({ where: { id: input.warningId, sessionId, kind: 'WARNING' } });
      if (!warning) throw new NotFoundException();
      // Disputing a warning also dismisses it from the learner's screen.
      for (const step of kind === 'WARNING_DISPUTED' ? (['WARNING_ACKNOWLEDGED', 'WARNING_DISPUTED'] as const) : (['WARNING_ACKNOWLEDGED'] as const)) {
        const already = await this.prisma.proctorEvent.findFirst({
          where: { sessionId, kind: step, data: { path: ['warningId'], equals: warning.id } },
          select: { id: true },
        });
        if (!already) await this.record(sessionId, step, step === 'WARNING_DISPUTED' ? { warningId: warning.id, note: note! } : { warningId: warning.id });
      }
      return;
    }
    const flags: Partial<Pick<ExamSession, 'cameraOn' | 'fullscreen' | 'tabVisible'>> =
      kind === 'CAMERA_ON' ? { cameraOn: true }
      : kind === 'CAMERA_OFF' ? { cameraOn: false }
      : kind === 'FULLSCREEN_ENTER' ? { fullscreen: true }
      : kind === 'FULLSCREEN_EXIT' ? { fullscreen: false }
      : kind === 'TAB_VISIBLE' ? { tabVisible: true }
      : kind === 'TAB_HIDDEN' ? { tabVisible: false }
      : {};
    if (Object.keys(flags).length) {
      await this.prisma.examSession.update({ where: { id: session.id }, data: { ...flags, lastSeenAt: new Date() } });
    }
    const recent = await this.prisma.proctorEvent.findFirst({
      where: { sessionId, kind, createdAt: { gte: new Date(Date.now() - EVENT_DEDUPE_MS) } },
      select: { id: true },
    });
    if (recent) return;
    const event = await this.record(sessionId, kind, kind === 'PROHIBITED_OBJECT' && input.object ? { object: input.object } : {});
    if (input.snapshot && AI_EVENT_KINDS.includes(kind)) await this.saveSnapshot(event, input.snapshot);
    if (AUTO_WARN_KINDS.includes(kind)) await this.autoWarn(session, kind);
  }

  /** Proctors who want to watch this learner (connection offers not yet answered). */
  async pendingOffers(user: AuthUser, sessionId: string): Promise<{ peerId: string; sdp: string }[]> {
    const session = await this.ownSession(user, sessionId);
    return session.status === 'IN_PROGRESS' ? this.hub.pendingOffers(sessionId) : [];
  }

  async answerOffer(user: AuthUser, sessionId: string, peerId: string, sdp: string): Promise<void> {
    const session = await this.ownSession(user, sessionId);
    if (session.status !== 'IN_PROGRESS') throw new ConflictException({ code: 'EXAM_FINISHED' });
    if (!this.hub.answer(sessionId, peerId, sdp)) throw new NotFoundException({ code: 'OFFER_GONE' });
  }

  /**
   * Called before grading an exam submission: the sitting must be running (or just
   * ended by a proctor) and within the deadline. Returns the session to close.
   */
  async assertCanSubmit(user: AuthUser, lesson: ExamLesson): Promise<ExamSession> {
    const session = await this.prisma.examSession.findUnique({
      where: { userId_lessonId: { userId: user.userId, lessonId: lesson.id } },
    });
    if (!session) throw new ConflictException({ code: 'EXAM_NOT_STARTED', message: 'Start the exam first' });
    if (session.submittedAt || session.status === 'SUBMITTED' || session.status === 'EXPIRED') {
      throw new ConflictException({ code: 'EXAM_FINISHED', message: 'This exam has already been submitted' });
    }
    if (Date.now() > session.endsAt.getTime() + SUBMIT_GRACE_MS) {
      await this.settle(session);
      throw new ConflictException({ code: 'EXAM_TIME_UP', message: 'The time for this exam is over' });
    }
    return session;
  }

  /** The graded attempt is stored: close the sitting. A proctor-ended one stays TERMINATED. */
  async markSubmitted(session: ExamSession, quizAttemptId: string): Promise<void> {
    await this.prisma.examSession.update({
      where: { id: session.id },
      data: {
        status: session.status === 'TERMINATED' ? 'TERMINATED' : 'SUBMITTED',
        submittedAt: new Date(),
        quizAttemptId,
      },
    });
    await this.record(session.id, 'SUBMITTED');
    this.hub.close(session.id);
  }

  // ---- Proctor ------------------------------------------------------------------

  async dashboard(user: AuthUser, lessonId: string): Promise<ProctorDashboard> {
    const lesson = await this.prisma.lesson.findFirst({
      where: { id: lessonId, deletedAt: null },
      include: { course: { select: { id: true, title: true, instructorId: true } } },
    });
    if (!lesson || !ExamsService.isExam(lesson)) throw new NotFoundException();
    await this.assertProctor(user, lesson.course);

    const rows = await this.prisma.examSession.findMany({
      where: { lessonId },
      orderBy: { startedAt: 'asc' },
      include: { user: { select: { id: true, displayName: true, email: true } } },
    });
    const sessions = await Promise.all(rows.map(async (row) => ({ ...row, ...(await this.settle(row)) })));
    const ids = sessions.map((s) => s.id);
    const [enrolledCount, kindCounts, events, attempts, warningRows, questionCount] = await Promise.all([
      this.prisma.enrollment.count({ where: { courseId: lesson.courseId } }),
      this.prisma.proctorEvent.groupBy({
        by: ['sessionId', 'kind'],
        where: { sessionId: { in: ids } },
        _count: { _all: true },
      }),
      this.prisma.proctorEvent.findMany({ where: { sessionId: { in: ids } }, orderBy: { createdAt: 'desc' }, take: 200 }),
      this.prisma.quizAttempt.findMany({
        where: { id: { in: sessions.map((s) => s.quizAttemptId).filter((id): id is string => !!id) } },
        select: { id: true, scorePercent: true },
      }),
      this.prisma.proctorEvent.findMany({
        where: { sessionId: { in: ids }, kind: { in: ['WARNING', 'WARNING_ACKNOWLEDGED'] } },
        select: { id: true, sessionId: true, kind: true, data: true },
      }),
      this.prisma.quizQuestion.count({ where: { lessonId, atSec: null } }),
    ]);
    const acknowledged = new Set(warningRows.filter((r) => r.kind === 'WARNING_ACKNOWLEDGED').map((r) => warningIdOf(r.data)));
    const unread = new Map<string, number>();
    for (const row of warningRows) {
      if (row.kind === 'WARNING' && !acknowledged.has(row.id)) unread.set(row.sessionId, (unread.get(row.sessionId) ?? 0) + 1);
    }
    const countsBySession = new Map<string, Partial<Record<ProctorEventKind, number>>>();
    for (const row of kindCounts) {
      const counts = countsBySession.get(row.sessionId) ?? {};
      counts[row.kind] = row._count._all;
      countsBySession.set(row.sessionId, counts);
    }
    const autoWarnings = new Map<string, number>();
    for (const row of warningRows) {
      if (row.kind === 'WARNING' && field(row.data, 'auto') === true) autoWarnings.set(row.sessionId, (autoWarnings.get(row.sessionId) ?? 0) + 1);
    }
    const alertsOf = (id: string) => ALERT_EVENT_KINDS.reduce((sum, kind) => sum + (countsBySession.get(id)?.[kind] ?? 0), 0);
    const scores = new Map(attempts.map((a) => [a.id, a.scorePercent]));
    const now = Date.now();

    return {
      lesson: {
        id: lesson.id,
        title: lesson.title,
        courseId: lesson.course.id,
        courseTitle: lesson.course.title,
        opensAt: lesson.examOpensAt?.toISOString() ?? null,
        closesAt: lesson.examClosesAt?.toISOString() ?? null,
        durationMin: lesson.examDurationMin ?? 60,
        proctored: lesson.examProctored,
        aiMonitoring: lesson.examProctored && lesson.examAiMonitoring,
        autoWarn: lesson.examAutoWarn,
        maxWarnings: lesson.examMaxWarnings,
        questionCount,
      },
      serverNow: new Date(now).toISOString(),
      enrolledCount,
      sessions: sessions.map((s) => ({
        id: s.id,
        learner: { id: s.user.id, name: s.user.displayName, email: s.user.email },
        status: s.status,
        startedAt: s.startedAt.toISOString(),
        endsAt: s.endsAt.toISOString(),
        submittedAt: s.submittedAt?.toISOString() ?? null,
        online: s.status === 'IN_PROGRESS' && !!s.lastSeenAt && now - s.lastSeenAt.getTime() < ONLINE_MS,
        cameraOn: s.cameraOn,
        fullscreen: s.fullscreen,
        tabVisible: s.tabVisible,
        streamEpoch: s.streamEpoch,
        alertCount: alertsOf(s.id),
        unreadWarnings: s.status === 'IN_PROGRESS' ? (unread.get(s.id) ?? 0) : 0,
        warningCount: countsBySession.get(s.id)?.WARNING ?? 0,
        answered: s.answeredCount,
        integrity: integrityFromCounts(countsBySession.get(s.id) ?? {}, autoWarnings.get(s.id) ?? 0).score,
        review: s.reviewStatus,
        scorePercent: s.quizAttemptId ? (scores.get(s.quizAttemptId) ?? null) : null,
      })),
      events: events.map((e) => this.toEventView(e, true)),
      iceServers: this.config.get('PROCTOR_ICE_SERVERS'),
    };
  }

  /** A proctor's dashboard asks to watch one learner's camera. */
  async proctorOffer(user: AuthUser, sessionId: string, peerId: string, sdp: string): Promise<void> {
    const session = await this.staffSession(user, sessionId);
    if (session.status !== 'IN_PROGRESS') throw new ConflictException({ code: 'EXAM_FINISHED' });
    this.hub.offer(sessionId, peerId, sdp);
  }

  /** Learners' answers to this dashboard's offers, for one exam. */
  async proctorAnswers(user: AuthUser, lessonId: string, peerId: string): Promise<{ sessionId: string; sdp: string }[]> {
    const lesson = await this.prisma.lesson.findFirst({
      where: { id: lessonId, deletedAt: null },
      select: { course: { select: { id: true, instructorId: true } } },
    });
    if (!lesson) throw new NotFoundException();
    await this.assertProctor(user, lesson.course);
    const running = await this.prisma.examSession.findMany({ where: { lessonId, status: 'IN_PROGRESS' }, select: { id: true } });
    return this.hub.takeAnswers(peerId, running.map((s) => s.id));
  }

  async warn(user: AuthUser, sessionId: string, message: string): Promise<void> {
    const session = await this.staffSession(user, sessionId);
    if (session.status !== 'IN_PROGRESS') throw new ConflictException({ code: 'EXAM_FINISHED' });
    await this.record(sessionId, 'WARNING', { message }, user.userId);
    await this.audit.log({ actorId: user.userId, action: 'exam.warned', resource: 'exam_session', resourceId: sessionId });
    await this.enforceWarningLimit(session);
  }

  /** A non-blocking message to one learner. */
  async notice(user: AuthUser, sessionId: string, message: string): Promise<void> {
    const session = await this.staffSession(user, sessionId);
    if (session.status !== 'IN_PROGRESS') throw new ConflictException({ code: 'EXAM_FINISHED' });
    await this.record(sessionId, 'NOTICE', { message }, user.userId);
  }

  /** A non-blocking message to everyone sitting the exam now. Returns how many got it. */
  async noticeAll(user: AuthUser, lessonId: string, message: string): Promise<{ sent: number }> {
    const lesson = await this.prisma.lesson.findFirst({
      where: { id: lessonId, deletedAt: null },
      select: { course: { select: { id: true, instructorId: true } } },
    });
    if (!lesson) throw new NotFoundException();
    await this.assertProctor(user, lesson.course);
    const running = await this.prisma.examSession.findMany({ where: { lessonId, status: 'IN_PROGRESS' } });
    const live = (await Promise.all(running.map((s) => this.settle(s)))).filter((s) => s.status === 'IN_PROGRESS');
    if (live.length) {
      await this.prisma.proctorEvent.createMany({
        data: live.map((s) => ({ sessionId: s.id, kind: 'NOTICE' as const, data: { message }, actorId: user.userId })),
      });
    }
    return { sent: live.length };
  }

  /** A sitting's integrity report for its proctors (with evidence snapshots). */
  async staffReport(user: AuthUser, sessionId: string): Promise<ExamReport> {
    await this.staffSession(user, sessionId);
    return this.report(sessionId, true);
  }

  /** My own report, once the exam is over (no evidence images). */
  async learnerReport(user: AuthUser, sessionId: string): Promise<ExamReport> {
    const session = await this.ownSession(user, sessionId);
    if (session.status === 'IN_PROGRESS') throw new ConflictException({ code: 'EXAM_RUNNING' });
    return this.report(sessionId, false);
  }

  /** The proctor's verdict on a finished sitting. */
  async review(user: AuthUser, sessionId: string, input: ExamReviewInput): Promise<ExamReport> {
    const session = await this.staffSession(user, sessionId);
    if (session.status === 'IN_PROGRESS') throw new ConflictException({ code: 'EXAM_RUNNING', message: 'Review the exam after it ends' });
    const note = input.note?.trim() || null;
    if (input.status === 'FLAGGED' && !note) throw new BadRequestException({ code: 'NOTE_REQUIRED', message: 'Say what was wrong' });
    await this.prisma.examSession.update({
      where: { id: sessionId },
      data: { reviewStatus: input.status, reviewNote: note, reviewedById: user.userId, reviewedAt: new Date() },
    });
    await this.record(sessionId, 'REVIEWED', { status: input.status, ...(note ? { note } : {}) }, user.userId);
    await this.audit.log({
      actorId: user.userId,
      action: 'exam.reviewed',
      resource: 'exam_session',
      resourceId: sessionId,
      metadata: { status: input.status },
    });
    return this.report(sessionId, true);
  }

  /** An AI alert's evidence image, for proctors of that exam. */
  async snapshot(user: AuthUser, eventId: string): Promise<{ dataUrl: string }> {
    const event = await this.prisma.proctorEvent.findUnique({ where: { id: eventId }, select: { sessionId: true, snapshotKey: true } });
    if (!event?.snapshotKey) throw new NotFoundException();
    await this.staffSession(user, event.sessionId);
    const bytes = await this.storage.readBuffer(event.snapshotKey);
    return { dataUrl: SNAPSHOT_PREFIX + bytes.toString('base64') };
  }

  /** End a learner's exam now. Their page submits the answers given so far. */
  async terminate(user: AuthUser, sessionId: string, reason: string): Promise<void> {
    const session = await this.staffSession(user, sessionId);
    if (session.status !== 'IN_PROGRESS') throw new ConflictException({ code: 'EXAM_FINISHED' });
    await this.endSession(sessionId, reason, user.userId);
    await this.audit.log({
      actorId: user.userId,
      action: 'exam.terminated',
      resource: 'exam_session',
      resourceId: sessionId,
      metadata: { reason },
    });
  }

  // ---- Helpers ------------------------------------------------------------------

  private async endSession(sessionId: string, reason: string, actorId?: string): Promise<void> {
    await this.prisma.examSession.update({ where: { id: sessionId }, data: { status: 'TERMINATED', terminatedReason: reason } });
    await this.record(sessionId, 'TERMINATED', actorId ? { reason } : { reason, auto: true }, actorId);
    this.hub.close(sessionId);
  }

  /** "Automatic warnings" exams: a serious alert becomes a warning (once a minute per kind). */
  private async autoWarn(session: ExamSession, kind: ProctorEventKind): Promise<void> {
    const lesson = await this.prisma.lesson.findUnique({ where: { id: session.lessonId }, select: { examAutoWarn: true } });
    if (!lesson?.examAutoWarn) return;
    const recent = await this.prisma.proctorEvent.findFirst({
      where: {
        sessionId: session.id,
        kind: 'WARNING',
        createdAt: { gte: new Date(Date.now() - AUTO_WARN_COOLDOWN_MS) },
        data: { path: ['code'], equals: kind },
      },
      select: { id: true },
    });
    if (recent) return;
    await this.record(session.id, 'WARNING', { message: AUTO_WARNING_TEXT[kind] ?? kind, code: kind, auto: true });
    await this.enforceWarningLimit(session);
  }

  /** Reaching the exam's warning limit ends it; the learner's page then submits the answers. */
  private async enforceWarningLimit(session: ExamSession): Promise<void> {
    const lesson = await this.prisma.lesson.findUnique({ where: { id: session.lessonId }, select: { examMaxWarnings: true } });
    const max = lesson?.examMaxWarnings ?? 0;
    if (max <= 0) return;
    const count = await this.prisma.proctorEvent.count({ where: { sessionId: session.id, kind: 'WARNING' } });
    if (count < max) return;
    const current = await this.prisma.examSession.findUnique({ where: { id: session.id }, select: { status: true } });
    if (current?.status !== 'IN_PROGRESS') return;
    await this.endSession(session.id, `Warning limit reached (${count} of ${max})`);
  }

  /** Stores an AI alert's evidence image (a small JPEG), if it is one. */
  private async saveSnapshot(event: ProctorEvent, dataUrl: string): Promise<void> {
    if (!dataUrl.startsWith(SNAPSHOT_PREFIX)) return;
    const bytes = Buffer.from(dataUrl.slice(SNAPSHOT_PREFIX.length), 'base64');
    const jpeg = bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
    if (!jpeg || bytes.length > SNAPSHOT_MAX_BYTES) return;
    const key = `proctor/${event.sessionId}/${event.id}.jpg`;
    try {
      await this.storage.putBuffer(key, bytes, 'image/jpeg');
      await this.prisma.proctorEvent.update({ where: { id: event.id }, data: { snapshotKey: key } });
    } catch {
      // The alert itself is recorded; the image is a nice-to-have.
    }
  }

  private async report(sessionId: string, staff: boolean): Promise<ExamReport> {
    const session = await this.prisma.examSession.findUniqueOrThrow({
      where: { id: sessionId },
      include: {
        user: { select: { id: true, displayName: true, email: true } },
        lesson: { select: { title: true, examMaxWarnings: true } },
        events: { orderBy: { createdAt: 'asc' } },
      },
    });
    const [attempt, reviewer] = await Promise.all([
      session.quizAttemptId
        ? this.prisma.quizAttempt.findUnique({ where: { id: session.quizAttemptId }, select: { scorePercent: true } })
        : null,
      session.reviewedById ? this.prisma.user.findUnique({ where: { id: session.reviewedById }, select: { displayName: true } }) : null,
    ]);
    const counts: Partial<Record<ProctorEventKind, number>> = {};
    let autoWarnings = 0;
    for (const e of session.events) {
      counts[e.kind] = (counts[e.kind] ?? 0) + 1;
      if (e.kind === 'WARNING' && field(e.data, 'auto') === true) autoWarnings += 1;
    }
    return {
      sessionId: session.id,
      lessonTitle: session.lesson.title,
      learner: { id: session.user.id, name: session.user.displayName, email: staff ? session.user.email : null },
      status: session.status,
      startedAt: session.startedAt.toISOString(),
      endsAt: session.endsAt.toISOString(),
      submittedAt: session.submittedAt?.toISOString() ?? null,
      terminatedReason: session.terminatedReason,
      scorePercent: attempt?.scorePercent ?? null,
      integrity: integrityFromCounts(counts, autoWarnings),
      warningCount: counts.WARNING ?? 0,
      maxWarnings: session.lesson.examMaxWarnings,
      alertCount: ALERT_EVENT_KINDS.reduce((sum, kind) => sum + (counts[kind] ?? 0), 0),
      review: {
        status: session.reviewStatus,
        note: session.reviewNote,
        reviewer: reviewer?.displayName ?? null,
        at: session.reviewedAt?.toISOString() ?? null,
      },
      events: session.events.map((e) => this.toEventView(e, staff)),
    };
  }

  private toEventView(e: ProctorEvent, staff: boolean): ProctorDashboard['events'][number] {
    return {
      id: e.id,
      sessionId: e.sessionId,
      kind: e.kind,
      data: (e.data ?? {}) as Record<string, unknown>,
      at: e.createdAt.toISOString(),
      snapshot: staff && !!e.snapshotKey,
    };
  }

  /** Running sittings past their deadline (plus grace) become EXPIRED. */
  private async settle<T extends ExamSession | null>(session: T): Promise<T> {
    if (!session || session.status !== 'IN_PROGRESS') return session;
    if (Date.now() <= session.endsAt.getTime() + SUBMIT_GRACE_MS) return session;
    const updated = await this.prisma.examSession.update({ where: { id: session.id }, data: { status: 'EXPIRED' } });
    await this.record(session.id, 'EXPIRED');
    this.hub.close(session.id);
    return updated as T;
  }

  private async toPublic(session: ExamSession): Promise<ExamSessionPublic> {
    const rows = await this.prisma.proctorEvent.findMany({
      where: { sessionId: session.id, kind: { in: ['WARNING', 'WARNING_ACKNOWLEDGED', 'WARNING_DISPUTED', 'NOTICE'] } },
      orderBy: { createdAt: 'asc' },
    });
    const read = new Set(rows.filter((r) => r.kind === 'WARNING_ACKNOWLEDGED').map((r) => warningIdOf(r.data)));
    const disputed = new Set(rows.filter((r) => r.kind === 'WARNING_DISPUTED').map((r) => warningIdOf(r.data)));
    const warnings = rows.filter((r) => r.kind === 'WARNING');
    const code = (data: Prisma.JsonValue) => {
      const value = field(data, 'code');
      return typeof value === 'string' && (AUTO_WARN_KINDS as readonly string[]).includes(value) ? (value as ProctorEventKind) : null;
    };
    return {
      id: session.id,
      status: session.status,
      startedAt: session.startedAt.toISOString(),
      endsAt: session.endsAt.toISOString(),
      submittedAt: session.submittedAt?.toISOString() ?? null,
      terminatedReason: session.terminatedReason,
      warnings: warnings.map((w) => ({
        id: w.id,
        message: String((w.data as { message?: unknown } | null)?.message ?? ''),
        at: w.createdAt.toISOString(),
        acknowledged: read.has(w.id),
        code: code(w.data),
        disputed: disputed.has(w.id),
      })),
      notices: rows
        .filter((r) => r.kind === 'NOTICE')
        .map((r) => ({ id: r.id, message: String(field(r.data, 'message') ?? ''), at: r.createdAt.toISOString() })),
    };
  }

  private async ownSession(user: AuthUser, sessionId: string): Promise<ExamSession> {
    const session = await this.prisma.examSession.findUnique({ where: { id: sessionId } });
    if (!session || session.userId !== user.userId) throw new NotFoundException();
    return this.settle(session);
  }

  private async staffSession(user: AuthUser, sessionId: string): Promise<ExamSession> {
    const session = await this.prisma.examSession.findUnique({ where: { id: sessionId }, include: SESSION_WITH_COURSE });
    if (!session) throw new NotFoundException();
    await this.assertProctor(user, session.lesson.course);
    return this.settle(session);
  }

  private async assertProctor(user: AuthUser, course: { id: string; instructorId: string | null }): Promise<void> {
    if (!(await this.permissions.can(user, course, 'grade'))) throw new ForbiddenException();
  }

  private record(sessionId: string, kind: ProctorEventKind, data: Prisma.InputJsonObject = {}, actorId?: string) {
    return this.prisma.proctorEvent.create({ data: { sessionId, kind, data, actorId: actorId ?? null } });
  }
}
