import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import {
  progressPercent,
  topicMastery,
  type GradedAnswer,
  type LearnerReport,
  type LessonReport,
  type LessonStatus,
} from '@obgyn/types';
import { type AuthUser } from '../auth/auth-user';
import { AccessService } from '../courses/access.service';
import { CoursePermissions } from '../courses/course-permissions';
import { DEFAULT_PASS_PERCENT, gradeQuiz } from '../learning/grading';
import { PrismaService } from '../prisma/prisma.service';

type StoredOption = { text: string; isCorrect: boolean };
type Attempt = { lessonId: string; scorePercent: number; passed: boolean; createdAt: Date };

/** Best / last score and history for one lesson's attempts (oldest first). */
function graded(attempts: Attempt[], passPercent: number) {
  const list = [...attempts].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  return {
    attempts: list.length,
    bestScore: list.length ? Math.max(...list.map((a) => a.scorePercent)) : null,
    lastScore: list.at(-1)?.scorePercent ?? null,
    passed: list.some((a) => a.passed),
    passPercent,
    history: list.map((a) => ({ scorePercent: a.scorePercent, passed: a.passed, at: a.createdAt.toISOString() })),
  };
}

/**
 * One learner's progress in one course: where they are, every lesson's
 * activity and tries, and strengths / weaknesses per question topic.
 * The same report is shown to the learner and to the course team.
 */
@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly permissions: CoursePermissions,
    private readonly access: AccessService,
  ) {}

  /** Course team: any enrolled student's report. */
  async forInstructor(user: AuthUser, courseId: string, learnerId: string): Promise<LearnerReport> {
    await this.permissions.assert(user, courseId, 'view');
    if (!(await this.access.isEnrolled(learnerId, courseId))) throw new NotFoundException();
    return this.build(courseId, learnerId);
  }

  /** Learner: their own report. */
  async forLearner(user: AuthUser, slug: string): Promise<LearnerReport> {
    const course = await this.prisma.course.findUnique({ where: { slug }, select: { id: true } });
    if (!course) throw new NotFoundException();
    if (!(await this.access.isEnrolled(user.userId, course.id))) throw new ForbiddenException({ code: 'NOT_ENROLLED', courseSlug: slug });
    return this.build(course.id, user.userId);
  }

  async build(courseId: string, userId: string): Promise<LearnerReport> {
    const course = await this.prisma.course.findUniqueOrThrow({
      where: { id: courseId },
      select: {
        id: true,
        slug: true,
        title: true,
        entranceTestEnabled: true,
        chapters: {
          where: { deletedAt: null },
          orderBy: { position: 'asc' },
          select: {
            id: true,
            title: true,
            lessons: {
              where: { deletedAt: null },
              orderBy: { position: 'asc' },
              select: { id: true, title: true, kind: true, durationSec: true, passPercent: true, mediaAsset: { select: { durationSec: true } } },
            },
          },
        },
      },
    });
    const lessons = course.chapters.flatMap((c) => c.lessons.map((l) => ({ ...l, chapterTitle: c.title })));
    const lessonIds = lessons.map((l) => l.id);
    const where = { userId, lessonId: { in: lessonIds } };

    const [learner, enrollment, topics, progress, quizAttempts, imagingAttempts, checkpointAnswers, questions, submissions, entrance] =
      await Promise.all([
        this.prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { id: true, displayName: true } }),
        this.prisma.enrollment.findUnique({ where: { userId_courseId: { userId, courseId } }, select: { createdAt: true } }),
        this.prisma.questionTopic.findMany({ where: { courseId }, orderBy: { position: 'asc' }, select: { id: true, name: true } }),
        this.prisma.lessonProgress.findMany({ where }),
        this.prisma.quizAttempt.findMany({ where, select: { lessonId: true, scorePercent: true, passed: true, createdAt: true, answers: true } }),
        this.prisma.imagingAttempt.findMany({ where, select: { lessonId: true, scorePercent: true, passed: true, createdAt: true } }),
        this.prisma.checkpointAnswer.findMany({ where, select: { questionId: true, attempts: true, passedAt: true } }),
        this.prisma.quizQuestion.findMany({
          where: { lessonId: { in: lessonIds } },
          orderBy: [{ atSec: 'asc' }, { position: 'asc' }],
          select: { id: true, lessonId: true, atSec: true, text: true, topicId: true, explanation: true, options: { select: { id: true, isCorrect: true } } },
        }),
        this.prisma.assignmentSubmission.findMany({ where, select: { lessonId: true, status: true } }),
        course.entranceTestEnabled
          ? this.prisma.entranceAttempt.findMany({
              where: { userId, courseId, submittedAt: { not: null } },
              orderBy: { submittedAt: 'asc' },
              select: { paper: true, answers: true, scorePercent: true, passed: true },
            })
          : Promise.resolve(null),
      ]);

    const topicName = new Map(topics.map((t) => [t.id, t.name]));
    const progressBy = new Map(progress.map((p) => [p.lessonId, p]));
    const answersBy = new Map(checkpointAnswers.map((a) => [a.questionId, a]));
    const submissionBy = new Map(submissions.map((s) => [s.lessonId, s.status]));
    const byLesson = <T extends { lessonId: string }>(rows: T[], id: string) => rows.filter((r) => r.lessonId === id);
    const answers: GradedAnswer[] = [];

    // In-video questions: right on the first try.
    for (const q of questions) {
      if (q.atSec === null) continue;
      const a = answersBy.get(q.id);
      if (a && a.attempts > 0) answers.push({ topicId: q.topicId, correct: a.attempts === 1 && a.passedAt !== null, source: 'VIDEO' });
    }
    // Quizzes: each question of the latest attempt.
    for (const lesson of lessons.filter((l) => l.kind === 'QUIZ')) {
      const latest = byLesson(quizAttempts, lesson.id).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
      if (!latest) continue;
      const quizQuestions = questions.filter((q) => q.lessonId === lesson.id && q.atSec === null);
      const result = gradeQuiz(quizQuestions, latest.answers as Record<string, string[]>, 0);
      for (const r of result.questions) {
        answers.push({ topicId: quizQuestions.find((q) => q.id === r.questionId)?.topicId ?? null, correct: r.correct, source: 'QUIZ' });
      }
    }
    // Entrance test: the latest real attempt (development skips have an empty paper).
    const realEntrance = (entrance ?? []).filter((e) => Array.isArray(e.paper) && (e.paper as unknown[]).length > 0);
    const lastEntrance = realEntrance.at(-1);
    if (lastEntrance) {
      const paper = lastEntrance.paper as { questionId: string }[];
      const bank = await this.prisma.bankQuestion.findMany({
        where: { id: { in: paper.map((p) => p.questionId) } },
        select: { id: true, topicId: true, options: true },
      });
      const picked = (lastEntrance.answers ?? {}) as Record<string, number[]>;
      for (const q of bank) {
        const correctIdx = (q.options as StoredOption[]).flatMap((o, i) => (o.isCorrect ? [i] : []));
        const chosen = picked[q.id] ?? [];
        answers.push({
          topicId: q.topicId,
          correct: chosen.length === correctIdx.length && correctIdx.every((i) => chosen.includes(i)),
          source: 'ENTRANCE',
        });
      }
    }

    const lessonReports = new Map<string, LessonReport>();
    for (const lesson of lessons) {
      const p = progressBy.get(lesson.id);
      const quizzes = byLesson(quizAttempts, lesson.id);
      const imaging = byLesson(imagingAttempts, lesson.id);
      const status: LessonStatus = p?.completedAt
        ? p.skipped
          ? 'SKIPPED'
          : 'COMPLETED'
        : p || quizzes.length || imaging.length || submissionBy.has(lesson.id)
          ? 'IN_PROGRESS'
          : 'NOT_STARTED';
      const checkpointQs = questions.filter((q) => q.lessonId === lesson.id && q.atSec !== null);
      const passPercent = lesson.passPercent ?? DEFAULT_PASS_PERCENT;
      lessonReports.set(lesson.id, {
        id: lesson.id,
        title: lesson.title,
        kind: lesson.kind,
        status,
        views: p?.views ?? 0,
        lastVisitedAt: p?.updatedAt.toISOString() ?? null,
        completedAt: p?.completedAt?.toISOString() ?? null,
        video:
          lesson.kind === 'VIDEO'
            ? { durationSec: lesson.mediaAsset?.durationSec ?? lesson.durationSec, watchedSec: p?.watchedSec ?? 0, furthestSec: p?.furthestSec ?? 0 }
            : null,
        checkpoints:
          lesson.kind === 'VIDEO' && checkpointQs.length
            ? {
                total: checkpointQs.length,
                passed: checkpointQs.filter((q) => answersBy.get(q.id)?.passedAt).length,
                attempts: checkpointQs.reduce((sum, q) => sum + (answersBy.get(q.id)?.attempts ?? 0), 0),
                firstTry: checkpointQs.filter((q) => answersBy.get(q.id)?.attempts === 1 && answersBy.get(q.id)?.passedAt).length,
                questions: checkpointQs.map((q) => ({
                  id: q.id,
                  text: q.text,
                  atSec: q.atSec!,
                  topic: q.topicId ? (topicName.get(q.topicId) ?? null) : null,
                  attempts: answersBy.get(q.id)?.attempts ?? 0,
                  passed: !!answersBy.get(q.id)?.passedAt,
                })),
              }
            : null,
        quiz: lesson.kind === 'QUIZ' ? graded(quizzes, passPercent) : null,
        imaging: lesson.kind === 'IMAGING' ? graded(imaging, passPercent) : null,
        assignment: lesson.kind === 'ASSIGNMENT' ? { status: submissionBy.get(lesson.id) ?? 'NOT_SUBMITTED' } : null,
      });
    }

    const done = (r: LessonReport) => r.status === 'COMPLETED' || r.status === 'SKIPPED';
    const reports = [...lessonReports.values()];
    const completedLessons = reports.filter(done).length;
    const pointer = (id: string | undefined) => {
      const l = lessons.find((x) => x.id === id);
      return l ? { id: l.id, title: l.title, chapterTitle: l.chapterTitle, kind: l.kind } : null;
    };
    const last = [...progress].sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())[0];
    const quizBests = reports.flatMap((r) => (r.quiz?.bestScore != null ? [r.quiz.bestScore] : []));
    const answeredCheckpoints = checkpointAnswers.filter((a) => a.attempts > 0);
    const firstTry = answeredCheckpoints.filter((a) => a.attempts === 1 && a.passedAt).length;
    const activity = [last?.updatedAt, ...quizAttempts.map((a) => a.createdAt), ...imagingAttempts.map((a) => a.createdAt)].filter(
      (d): d is Date => !!d,
    );

    return {
      learner,
      course: { id: course.id, slug: course.slug, title: course.title },
      overview: {
        completedLessons,
        totalLessons: lessons.length,
        percent: progressPercent(completedLessons, lessons.length),
        enrolledAt: enrollment?.createdAt.toISOString() ?? null,
        lastActivityAt: activity.length ? new Date(Math.max(...activity.map((d) => d.getTime()))).toISOString() : null,
        lastLesson: pointer(last?.lessonId),
        nextLesson: pointer(reports.find((r) => !done(r))?.id),
        watchedSec: progress.reduce((sum, p) => sum + p.watchedSec, 0),
        quizAttempts: quizAttempts.length,
        averageQuizScore: quizBests.length ? Math.round(quizBests.reduce((a, b) => a + b, 0) / quizBests.length) : null,
        checkpointTries: answeredCheckpoints.reduce((sum, a) => sum + a.attempts, 0),
        checkpointFirstTryPercent: answeredCheckpoints.length ? Math.round((firstTry / answeredCheckpoints.length) * 100) : null,
        entrance: course.entranceTestEnabled
          ? // Passed counts any passing record (incl. development skips), matching the students list.
            { passed: (entrance ?? []).some((e) => e.passed), attempts: realEntrance.length, lastScore: lastEntrance?.scorePercent ?? null }
          : null,
      },
      topics: topicMastery(answers, topics),
      chapters: course.chapters.map((c) => {
        const list = c.lessons.map((l) => lessonReports.get(l.id)!);
        return { id: c.id, title: c.title, completed: list.filter(done).length, total: list.length, lessons: list };
      }),
    };
  }
}
