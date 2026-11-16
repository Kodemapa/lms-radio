import { Injectable, NotFoundException } from '@nestjs/common';
import {
  maskEmail,
  progressPercent,
  type AssessmentKind,
  type AssessmentReport,
  type AssessmentSummary,
  type AttemptDetail,
  type CourseAnalytics,
  type CourseStudent,
  type CourseStudents,
  type DayCount,
  type ImagingResultItem,
  type ItemAnalysis,
  type LearnerAttempts,
} from '@obgyn/types';
import { type AuthUser } from '../auth/auth-user';
import { LIVE_LESSON } from '../common/soft-delete';
import { CoursePermissions } from '../courses/course-permissions';
import { readKey } from '../imaging/grading';
import { DEFAULT_PASS_PERCENT } from '../learning/grading';
import { PrismaService } from '../prisma/prisma.service';

/** Students listed / exported per course at most (in-memory sort and paging). */
const MAX_STUDENTS = 10_000;
const DAY_MS = 24 * 60 * 60 * 1000;
/** Days are counted in India Standard Time. */
const IST_OFFSET_MS = 330 * 60 * 1000;

export const istDay = (date: Date) => new Date(date.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);

/** Zero-filled day counts for the last `days` days, oldest first. */
export function countByDay(dates: Date[], days: number, now = new Date()): DayCount[] {
  const counts = new Map<string, number>();
  for (const date of dates) counts.set(istDay(date), (counts.get(istDay(date)) ?? 0) + 1);
  return Array.from({ length: days }, (_, i) => {
    const date = istDay(new Date(now.getTime() - (days - 1 - i) * DAY_MS));
    return { date, count: counts.get(date) ?? 0 };
  });
}

/** CSV (UTF-8 with BOM so Excel opens Hindi names correctly; formulas neutralised). */
export function toStudentsCsv(rows: CourseStudent[]): string {
  const cell = (value: string | number | null) => {
    const text = value === null ? '' : String(value);
    // A leading = + - @ would run as a formula in Excel (CSV injection).
    const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
    return `"${safe.replace(/"/g, '""')}"`;
  };
  const header = ['Name', 'Email', 'Enrolled', 'Completed lessons', 'Total lessons', 'Progress %', 'Last activity', 'Entrance passed', 'Certificate'];
  const lines = rows.map((r) =>
    [
      r.displayName,
      r.email,
      r.enrolledAt.slice(0, 10),
      r.completedLessons,
      r.totalLessons,
      r.progressPercent,
      r.lastActivityAt?.slice(0, 10) ?? null,
      r.entrancePassed === null ? null : r.entrancePassed ? 'yes' : 'no',
      r.certificateSerial,
    ]
      .map(cell)
      .join(','),
  );
  return `\uFEFF${[header.map(cell).join(','), ...lines].join('\r\n')}\r\n`;
}

interface RawAttempt {
  id: string;
  userId: string;
  scorePercent: number;
  passed: boolean;
  createdAt: Date;
}

/** Per-learner attempt summary, plus each learner's latest attempt id. */
export function summariseAttempts(attempts: RawAttempt[], names: Map<string, string>): LearnerAttempts[] {
  const byUser = new Map<string, RawAttempt[]>();
  for (const a of attempts) byUser.set(a.userId, [...(byUser.get(a.userId) ?? []), a]);
  return [...byUser].map(([userId, list]) => {
    const sorted = [...list].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    const last = sorted.at(-1)!;
    return {
      userId,
      displayName: names.get(userId) ?? '—',
      attempts: list.length,
      bestScore: Math.max(...list.map((a) => a.scorePercent)),
      lastScore: last.scorePercent,
      passed: list.some((a) => a.passed),
      lastAttemptAt: last.createdAt.toISOString(),
      lastAttemptId: last.id,
    };
  });
}

function summary(kind: AssessmentKind, lessonId: string | null, title: string, passPercent: number, learners: LearnerAttempts[]): AssessmentSummary {
  return {
    lessonId,
    kind,
    title,
    passPercent,
    attempts: learners.reduce((s, l) => s + l.attempts, 0),
    learners: learners.length,
    passedLearners: learners.filter((l) => l.passed).length,
    averageBestScore: learners.length ? Math.round(learners.reduce((s, l) => s + l.bestScore, 0) / learners.length) : null,
  };
}

type StoredOption = { text: string; isCorrect: boolean };

/** Most frequent value, or null. */
function mode(values: string[]): string | null {
  const counts = new Map<string, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  let best: string | null = null;
  let bestCount = 0;
  for (const [v, c] of counts) if (c > bestCount) [best, bestCount] = [v, c];
  return best;
}

/**
 * Read-only teaching insight for the course team: who is enrolled and how
 * far they are, assessment reports with item analysis, and course analytics.
 */
@Injectable()
export class InsightsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly permissions: CoursePermissions,
  ) {}

  /**
   * The course team (owner and co-instructors) previews courses as learners;
   * leave them out of student lists, analytics and reports.
   */
  private async teamIds(courseId: string): Promise<string[]> {
    const [course, collaborators] = await Promise.all([
      this.prisma.course.findUnique({ where: { id: courseId }, select: { instructorId: true } }),
      this.prisma.courseCollaborator.findMany({ where: { courseId }, select: { userId: true } }),
    ]);
    return [...(course?.instructorId ? [course.instructorId] : []), ...collaborators.map((c) => c.userId)];
  }

  // ---- Students ----------------------------------------------------------------------

  async allStudents(user: AuthUser, courseId: string, q = ''): Promise<CourseStudent[]> {
    const { course } = await this.permissions.assert(user, courseId, 'view');
    const full = await this.prisma.course.findUniqueOrThrow({ where: { id: course.id }, select: { entranceTestEnabled: true } });
    const search = q.trim();
    const team = await this.teamIds(courseId);
    const [totalLessons, enrollments] = await Promise.all([
      this.prisma.lesson.count({ where: { courseId, ...LIVE_LESSON } }),
      this.prisma.enrollment.findMany({
        where: {
          courseId,
          userId: { notIn: team },
          ...(search
            ? { user: { OR: [{ displayName: { contains: search, mode: 'insensitive' } }, { email: { contains: search, mode: 'insensitive' } }] } }
            : {}),
        },
        include: { user: { select: { id: true, displayName: true, email: true } } },
        orderBy: { createdAt: 'desc' },
        take: MAX_STUDENTS,
      }),
    ]);
    const ids = enrollments.map((e) => e.userId);
    const [completed, activity, certificates, entrance] = await Promise.all([
      this.prisma.lessonProgress.groupBy({
        by: ['userId'],
        where: { courseId, userId: { in: ids }, completedAt: { not: null }, lesson: LIVE_LESSON },
        _count: { _all: true },
      }),
      this.prisma.lessonProgress.groupBy({ by: ['userId'], where: { courseId, userId: { in: ids } }, _max: { updatedAt: true } }),
      this.prisma.certificate.findMany({ where: { courseId, userId: { in: ids } }, select: { userId: true, serial: true } }),
      full.entranceTestEnabled
        ? this.prisma.entranceAttempt.findMany({ where: { courseId, userId: { in: ids }, passed: true }, select: { userId: true } })
        : Promise.resolve(null),
    ]);
    const done = new Map(completed.map((r) => [r.userId, r._count._all]));
    const last = new Map(activity.map((r) => [r.userId, r._max.updatedAt]));
    const certs = new Map(certificates.map((c) => [c.userId, c.serial]));
    const passed = entrance ? new Set(entrance.map((e) => e.userId)) : null;
    return enrollments.map((e) => {
      const completedLessons = Math.min(done.get(e.userId) ?? 0, totalLessons);
      return {
        userId: e.userId,
        displayName: e.user.displayName,
        email: maskEmail(e.user.email),
        enrolledAt: e.createdAt.toISOString(),
        completedLessons,
        totalLessons,
        progressPercent: progressPercent(completedLessons, totalLessons),
        lastActivityAt: last.get(e.userId)?.toISOString() ?? null,
        entrancePassed: passed ? passed.has(e.userId) : null,
        certificateSerial: certs.get(e.userId) ?? null,
      };
    });
  }

  async students(
    user: AuthUser,
    courseId: string,
    { q = '', sort = 'recent', page = 1, pageSize = 25 }: { q?: string; sort?: string; page?: number; pageSize?: number },
  ): Promise<CourseStudents> {
    const all = await this.allStudents(user, courseId, q);
    const sorted = [...all];
    if (sort === 'progress') sorted.sort((a, b) => b.progressPercent - a.progressPercent);
    else if (sort === 'name') sorted.sort((a, b) => a.displayName.localeCompare(b.displayName));
    else if (sort === 'activity') sorted.sort((a, b) => (b.lastActivityAt ?? '').localeCompare(a.lastActivityAt ?? ''));
    const size = Math.min(Math.max(pageSize, 1), 100);
    const current = Math.max(page, 1);
    return { total: all.length, page: current, pageSize: size, items: sorted.slice((current - 1) * size, current * size) };
  }

  async studentsCsv(user: AuthUser, courseId: string): Promise<string> {
    return toStudentsCsv(await this.allStudents(user, courseId));
  }

  // ---- Analytics ---------------------------------------------------------------------

  async analytics(user: AuthUser, courseId: string, now = new Date()): Promise<CourseAnalytics> {
    await this.permissions.assert(user, courseId, 'view');
    const since30 = new Date(now.getTime() - 30 * DAY_MS);
    const since7 = new Date(now.getTime() - 7 * DAY_MS);
    const learners = { notIn: await this.teamIds(courseId) };
    const [enrolled, recentEnrolments, lessons, perLesson, perUser, started, active, certificates] = await Promise.all([
      this.prisma.enrollment.count({ where: { courseId, userId: learners } }),
      this.prisma.enrollment.findMany({ where: { courseId, userId: learners, createdAt: { gte: since30 } }, select: { createdAt: true } }),
      this.prisma.lesson.findMany({
        where: { courseId, ...LIVE_LESSON },
        orderBy: [{ chapter: { position: 'asc' } }, { position: 'asc' }],
        select: { id: true, title: true, kind: true, chapter: { select: { title: true } } },
      }),
      this.prisma.lessonProgress.groupBy({ by: ['lessonId'], where: { courseId, userId: learners, completedAt: { not: null }, lesson: LIVE_LESSON }, _count: { _all: true } }),
      this.prisma.lessonProgress.groupBy({ by: ['userId'], where: { courseId, userId: learners, completedAt: { not: null }, lesson: LIVE_LESSON }, _count: { _all: true } }),
      this.prisma.lessonProgress.groupBy({ by: ['userId'], where: { courseId, userId: learners } }),
      this.prisma.lessonProgress.groupBy({ by: ['userId'], where: { courseId, userId: learners, updatedAt: { gte: since7 } } }),
      this.prisma.certificate.count({ where: { courseId, userId: learners } }),
    ]);
    const completedByLesson = new Map(perLesson.map((r) => [r.lessonId, r._count._all]));
    return {
      enrolled,
      started: started.length,
      completedAll: lessons.length ? perUser.filter((r) => r._count._all >= lessons.length).length : 0,
      certificates,
      activeLast7Days: active.length,
      enrolmentsByDay: countByDay(recentEnrolments.map((e) => e.createdAt), 30, now),
      lessons: lessons.map((l) => {
        const completed = completedByLesson.get(l.id) ?? 0;
        return {
          lessonId: l.id,
          chapterTitle: l.chapter.title,
          title: l.title,
          kind: l.kind,
          completed,
          completionPercent: enrolled ? Math.round((completed / enrolled) * 100) : 0,
        };
      }),
    };
  }

  // ---- Assessment reports ----------------------------------------------------------------

  async assessments(user: AuthUser, courseId: string): Promise<AssessmentSummary[]> {
    await this.permissions.assert(user, courseId, 'view');
    const course = await this.prisma.course.findUniqueOrThrow({
      where: { id: courseId },
      select: { entranceTestEnabled: true, entrancePassPercent: true },
    });
    const lessons = await this.prisma.lesson.findMany({
      where: { courseId, kind: { in: ['QUIZ', 'IMAGING'] }, ...LIVE_LESSON },
      orderBy: [{ chapter: { position: 'asc' } }, { position: 'asc' }],
      select: { id: true, title: true, kind: true, passPercent: true },
    });
    const ids = lessons.map((l) => l.id);
    const learners = { notIn: await this.teamIds(courseId) };
    const select = { id: true, userId: true, lessonId: true, scorePercent: true, passed: true, createdAt: true } as const;
    const [quiz, imaging, entrance] = await Promise.all([
      this.prisma.quizAttempt.findMany({ where: { lessonId: { in: ids }, userId: learners }, select }),
      this.prisma.imagingAttempt.findMany({ where: { lessonId: { in: ids }, userId: learners }, select }),
      course.entranceTestEnabled ? this.entranceAttempts(courseId) : Promise.resolve([]),
    ]);
    const empty = new Map<string, string>();
    const result: AssessmentSummary[] = [];
    if (course.entranceTestEnabled) {
      result.push(summary('ENTRANCE', null, 'Entrance test', course.entrancePassPercent, summariseAttempts(entrance, empty)));
    }
    for (const lesson of lessons) {
      const attempts = (lesson.kind === 'QUIZ' ? quiz : imaging).filter((a) => a.lessonId === lesson.id);
      result.push(summary(lesson.kind as AssessmentKind, lesson.id, lesson.title, lesson.passPercent ?? DEFAULT_PASS_PERCENT, summariseAttempts(attempts, empty)));
    }
    return result;
  }

  /** One assessment: per-learner attempts and item analysis of each learner's latest attempt. */
  async report(user: AuthUser, courseId: string, lessonId: string | null): Promise<AssessmentReport> {
    await this.permissions.assert(user, courseId, 'view');
    if (lessonId === null) return this.entranceReport(courseId);
    const lesson = await this.prisma.lesson.findFirst({ where: { id: lessonId, courseId, kind: { in: ['QUIZ', 'IMAGING'] }, ...LIVE_LESSON } });
    if (!lesson) throw new NotFoundException();
    const passPercent = lesson.passPercent ?? DEFAULT_PASS_PERCENT;
    if (lesson.kind === 'QUIZ') {
      const attempts = await this.prisma.quizAttempt.findMany({ where: { lessonId, userId: { notIn: await this.teamIds(courseId) } }, orderBy: { createdAt: 'asc' } });
      const learners = summariseAttempts(attempts, await this.names(attempts.map((a) => a.userId)));
      const latest = new Map(learners.map((l) => [l.lastAttemptId, true]));
      const questions = await this.prisma.quizQuestion.findMany({
        where: { lessonId, atSec: null },
        orderBy: { position: 'asc' },
        include: { options: true },
      });
      const items: ItemAnalysis[] = questions.map((q) => {
        const correct = new Set(q.options.filter((o) => o.isCorrect).map((o) => o.id));
        const chosen = attempts.filter((a) => latest.has(a.id)).map((a) => ((a.answers as Record<string, string[]>)[q.id] ?? []));
        const answered = chosen.filter((c) => c.length > 0);
        const right = answered.filter((c) => c.length === correct.size && c.every((id) => correct.has(id))).length;
        const wrongPicks = answered.flatMap((c) => c.filter((id) => !correct.has(id)));
        return {
          id: q.id,
          label: q.text,
          answered: answered.length,
          correctPercent: answered.length ? Math.round((right / answered.length) * 100) : 0,
          commonMistake: q.options.find((o) => o.id === mode(wrongPicks))?.text ?? null,
        };
      });
      return { summary: summary('QUIZ', lessonId, lesson.title, passPercent, learners), learners, items };
    }
    const attempts = await this.prisma.imagingAttempt.findMany({ where: { lessonId, userId: { notIn: await this.teamIds(courseId) } }, orderBy: { createdAt: 'asc' } });
    const learners = summariseAttempts(attempts, await this.names(attempts.map((a) => a.userId)));
    const latest = attempts.filter((a) => learners.some((l) => l.lastAttemptId === a.id)).map((a) => a.result as unknown as ImagingResultItem[]);
    // Analyse the case's current answer key only (items from an edited-away key would mislead).
    const kase = await this.prisma.imagingCase.findUnique({ where: { lessonId }, select: { key: true } });
    const key = readKey(kase?.key);
    const current = new Set([...key.annotations, ...key.findings, ...key.reportFields].map((i) => i.id));
    const order: { id: string; label: string }[] = [];
    for (const items of latest) for (const item of items) if (current.has(item.id) && !order.some((o) => o.id === item.id)) order.push({ id: item.id, label: item.label });
    const items: ItemAnalysis[] = order.map(({ id, label }) => {
      const results = latest.flatMap((list) => list.filter((i) => i.id === id));
      const passedCount = results.filter((r) => r.passed).length;
      return {
        id,
        label,
        answered: results.length,
        correctPercent: results.length ? Math.round((passedCount / results.length) * 100) : 0,
        commonMistake: mode(results.flatMap((r) => (r.reason ? [r.reason] : []))),
      };
    });
    return { summary: summary('IMAGING', lessonId, lesson.title, passPercent, learners), learners, items };
  }

  async attempt(user: AuthUser, kind: AssessmentKind, attemptId: string): Promise<AttemptDetail> {
    if (kind === 'QUIZ') {
      const attempt = await this.prisma.quizAttempt.findUnique({
        where: { id: attemptId },
        include: { lesson: { select: { title: true, courseId: true } }, user: { select: { id: true, displayName: true } } },
      });
      if (!attempt) throw new NotFoundException();
      await this.permissions.assert(user, attempt.lesson.courseId, 'view');
      const questions = await this.prisma.quizQuestion.findMany({ where: { lessonId: attempt.lessonId, atSec: null }, orderBy: { position: 'asc' }, include: { options: true } });
      const answers = attempt.answers as Record<string, string[]>;
      return {
        id: attempt.id,
        kind,
        title: attempt.lesson.title,
        learner: attempt.user,
        createdAt: attempt.createdAt.toISOString(),
        scorePercent: attempt.scorePercent,
        passed: attempt.passed,
        items: questions.map((q) => {
          const chosen = answers[q.id] ?? [];
          const correctIds = q.options.filter((o) => o.isCorrect).map((o) => o.id);
          const correct = chosen.length === correctIds.length && correctIds.every((id) => chosen.includes(id));
          return {
            label: q.text,
            correct,
            credit: correct ? 1 : 0,
            answer: chosen.length ? q.options.filter((o) => chosen.includes(o.id)).map((o) => o.text).join(', ') : null,
            expected: q.options.filter((o) => o.isCorrect).map((o) => o.text).join(', '),
          };
        }),
      };
    }
    if (kind === 'IMAGING') {
      const attempt = await this.prisma.imagingAttempt.findUnique({
        where: { id: attemptId },
        include: { lesson: { select: { title: true, courseId: true } }, user: { select: { id: true, displayName: true } } },
      });
      if (!attempt) throw new NotFoundException();
      await this.permissions.assert(user, attempt.lesson.courseId, 'view');
      const items = attempt.result as unknown as ImagingResultItem[];
      return {
        id: attempt.id,
        kind,
        title: attempt.lesson.title,
        learner: attempt.user,
        createdAt: attempt.createdAt.toISOString(),
        scorePercent: attempt.scorePercent,
        passed: attempt.passed,
        items: items.map((i) => ({ label: i.label, correct: i.passed, credit: i.marks ? i.earned / i.marks : 0, answer: i.actual, expected: i.expected })),
      };
    }
    const attempt = await this.prisma.entranceAttempt.findUnique({
      where: { id: attemptId },
      include: { user: { select: { id: true, displayName: true } } },
    });
    if (!attempt || !attempt.submittedAt) throw new NotFoundException();
    await this.permissions.assert(user, attempt.courseId, 'view');
    const paper = (attempt.paper ?? []) as { questionId: string }[];
    const bank = await this.prisma.bankQuestion.findMany({ where: { id: { in: paper.map((p) => p.questionId) } }, select: { id: true, text: true, options: true } });
    const answers = (attempt.answers ?? {}) as Record<string, number[]>;
    return {
      id: attempt.id,
      kind,
      title: 'Entrance test',
      learner: attempt.user,
      createdAt: attempt.submittedAt.toISOString(),
      scorePercent: attempt.scorePercent ?? 0,
      passed: attempt.passed ?? false,
      items: paper.map(({ questionId }) => {
        const q = bank.find((b) => b.id === questionId);
        const options = (q?.options ?? []) as StoredOption[];
        const correctIdx = options.flatMap((o, i) => (o.isCorrect ? [i] : []));
        const picked = answers[questionId] ?? [];
        const correct = picked.length === correctIdx.length && correctIdx.every((i) => picked.includes(i));
        return {
          label: q?.text ?? '(question removed from the bank)',
          correct,
          credit: correct ? 1 : 0,
          answer: picked.length ? picked.map((i) => options[i]?.text ?? '?').join(', ') : null,
          expected: correctIdx.map((i) => options[i]!.text).join(', '),
        };
      }),
    };
  }

  // ---- Helpers ----------------------------------------------------------------------

  private async entranceAttempts(courseId: string): Promise<RawAttempt[]> {
    const rows = await this.prisma.entranceAttempt.findMany({
      where: { courseId, submittedAt: { not: null }, userId: { notIn: await this.teamIds(courseId) } },
      select: { id: true, userId: true, scorePercent: true, passed: true, submittedAt: true, paper: true },
    });
    // Development "skip" records have an empty paper; they are not real attempts.
    return rows
      .filter((r) => Array.isArray(r.paper) && (r.paper as unknown[]).length > 0)
      .map((r) => ({ id: r.id, userId: r.userId, scorePercent: r.scorePercent ?? 0, passed: r.passed ?? false, createdAt: r.submittedAt! }));
  }

  private async entranceReport(courseId: string): Promise<AssessmentReport> {
    const course = await this.prisma.course.findUniqueOrThrow({ where: { id: courseId }, select: { entranceTestEnabled: true, entrancePassPercent: true } });
    if (!course.entranceTestEnabled) throw new NotFoundException();
    const attempts = await this.entranceAttempts(courseId);
    const learners = summariseAttempts(attempts, await this.names(attempts.map((a) => a.userId)));
    // Papers are random draws from the bank, so analyse per bank question across latest attempts.
    const latest = await this.prisma.entranceAttempt.findMany({
      where: { id: { in: learners.map((l) => l.lastAttemptId) } },
      select: { paper: true, answers: true },
    });
    const ids = [...new Set(latest.flatMap((a) => ((a.paper ?? []) as { questionId: string }[]).map((p) => p.questionId)))];
    const bank = await this.prisma.bankQuestion.findMany({ where: { id: { in: ids } }, select: { id: true, text: true, options: true } });
    const items: ItemAnalysis[] = bank.map((q) => {
      const options = q.options as StoredOption[];
      const correctIdx = options.flatMap((o, i) => (o.isCorrect ? [i] : []));
      const picks = latest
        .filter((a) => ((a.paper ?? []) as { questionId: string }[]).some((p) => p.questionId === q.id))
        .map((a) => ((a.answers ?? {}) as Record<string, number[]>)[q.id] ?? []);
      const answered = picks.filter((p) => p.length);
      const right = answered.filter((p) => p.length === correctIdx.length && correctIdx.every((i) => p.includes(i))).length;
      const wrong = answered.flatMap((p) => p.filter((i) => !correctIdx.includes(i)).map(String));
      const common = mode(wrong);
      return {
        id: q.id,
        label: q.text,
        answered: answered.length,
        correctPercent: answered.length ? Math.round((right / answered.length) * 100) : 0,
        commonMistake: common === null ? null : (options[Number(common)]?.text ?? null),
      };
    });
    return { summary: summary('ENTRANCE', null, 'Entrance test', course.entrancePassPercent, learners), learners, items };
  }

  private async names(ids: string[]): Promise<Map<string, string>> {
    const users = await this.prisma.user.findMany({ where: { id: { in: [...new Set(ids)] } }, select: { id: true, displayName: true } });
    return new Map(users.map((u) => [u.id, u.displayName]));
  }
}
