import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  drawRandom,
  shuffle,
  type EntrancePaper,
  type EntranceResult,
  type EntranceStatus,
} from '@obgyn/types';
import { Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { AppConfigService } from '../config/app-config.service';
import { type AuthUser } from '../auth/auth-user';
import { PrismaService } from '../prisma/prisma.service';

type StoredOption = { text: string; isCorrect: boolean };
type PaperEntry = { questionId: string; optionOrder: number[] };

/** An unfinished attempt older than this is abandoned and counts as used. */
const ATTEMPT_WINDOW_MS = 3 * 60 * 60 * 1000;

/**
 * Entrance (pre-course) test: each attempt draws a random set of bank
 * questions with shuffled options. Only learners who pass can enrol.
 */
@Injectable()
export class EntranceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly config: AppConfigService,
  ) {}

  /**
   * Development only: record a pass without sitting the test, so testers can
   * reach the course quickly. Refused whenever the API runs in production.
   */
  async devSkip(user: AuthUser, slug: string): Promise<EntranceStatus> {
    if (this.config.isProduction) throw new ForbiddenException({ code: 'DEV_ONLY' });
    const course = await this.course(slug);
    if (!course.entranceTestEnabled) throw new BadRequestException({ code: 'NO_ENTRANCE_TEST' });
    const current = await this.status(user, slug);
    if (!current.passed) {
      // Close any open attempt, then add a passed one.
      await this.prisma.entranceAttempt.updateMany({
        where: { userId: user.userId, courseId: course.id, submittedAt: null },
        data: { submittedAt: new Date(), scorePercent: 0, passed: false },
      });
      await this.prisma.entranceAttempt.create({
        data: { userId: user.userId, courseId: course.id, paper: [], scorePercent: 100, passed: true, submittedAt: new Date() },
      });
      if (course.isFree) {
        await this.prisma.enrollment.upsert({
          where: { userId_courseId: { userId: user.userId, courseId: course.id } },
          create: { userId: user.userId, courseId: course.id },
          update: {},
        });
      }
      await this.audit.log({ actorId: user.userId, action: 'entrance.dev_skipped', resource: 'course', resourceId: course.id });
    }
    return this.status(user, slug);
  }

  async status(user: AuthUser, slug: string): Promise<EntranceStatus> {
    const course = await this.course(slug);
    const attempts = await this.prisma.entranceAttempt.findMany({
      where: { userId: user.userId, courseId: course.id },
      orderBy: { startedAt: 'desc' },
    });
    const open = attempts.find((a) => !a.submittedAt && Date.now() - a.startedAt.getTime() < ATTEMPT_WINDOW_MS);
    const finished = attempts.filter((a) => a.submittedAt);
    return {
      required: course.entranceTestEnabled,
      passed: attempts.some((a) => a.passed),
      attemptsUsed: attempts.filter((a) => a !== open).length,
      maxAttempts: course.entranceMaxAttempts,
      questionCount: course.entranceQuestionCount,
      passPercent: course.entrancePassPercent,
      lastScore: finished[0]?.scorePercent ?? null,
      openAttemptId: open?.id ?? null,
    };
  }

  async start(user: AuthUser, slug: string): Promise<EntrancePaper> {
    const course = await this.course(slug);
    if (!course.entranceTestEnabled) throw new BadRequestException({ code: 'NO_ENTRANCE_TEST' });
    const status = await this.status(user, slug);
    if (status.passed) throw new ConflictException({ code: 'ALREADY_PASSED' });

    if (status.openAttemptId) {
      const open = await this.prisma.entranceAttempt.findUniqueOrThrow({ where: { id: status.openAttemptId } });
      return this.toPaper(open.id, open.paper as PaperEntry[], course.entrancePassPercent);
    }
    if (course.entranceMaxAttempts !== null && status.attemptsUsed >= course.entranceMaxAttempts) {
      throw new ForbiddenException({ code: 'NO_ATTEMPTS_LEFT' });
    }

    const pool = await this.prisma.bankQuestion.findMany({
      where: { courseId: course.id, ...(course.entranceTopicId ? { topicId: course.entranceTopicId } : {}) },
      select: { id: true, options: true },
    });
    if (pool.length === 0) throw new ConflictException({ code: 'EMPTY_POOL' });
    const paper: PaperEntry[] = drawRandom(pool, course.entranceQuestionCount).map((q) => ({
      questionId: q.id,
      optionOrder: shuffle((q.options as StoredOption[]).map((_, i) => i)),
    }));
    const attempt = await this.prisma.entranceAttempt.create({
      data: { userId: user.userId, courseId: course.id, paper: paper as unknown as Prisma.InputJsonValue },
    });
    return this.toPaper(attempt.id, paper, course.entrancePassPercent);
  }

  async submit(
    user: AuthUser,
    slug: string,
    attemptId: string,
    answers: Record<string, number[]>,
  ): Promise<EntranceResult> {
    const course = await this.course(slug);
    const attempt = await this.prisma.entranceAttempt.findUnique({ where: { id: attemptId } });
    if (!attempt || attempt.userId !== user.userId || attempt.courseId !== course.id) throw new NotFoundException();
    if (attempt.submittedAt) throw new ConflictException({ code: 'ALREADY_SUBMITTED' });

    const paper = attempt.paper as PaperEntry[];
    const questions = await this.prisma.bankQuestion.findMany({
      where: { id: { in: paper.map((p) => p.questionId) } },
      select: { id: true, options: true },
    });
    const byId = new Map(questions.map((q) => [q.id, q.options as StoredOption[]]));
    let correctCount = 0;
    for (const { questionId } of paper) {
      const options = byId.get(questionId);
      if (!options) continue; // removed from the bank since: counts as wrong
      const correct = options.flatMap((o, i) => (o.isCorrect ? [i] : []));
      const picked = [...new Set((answers?.[questionId] ?? []).filter((k) => Number.isInteger(k)))];
      if (picked.length === correct.length && correct.every((k) => picked.includes(k))) correctCount += 1;
    }
    const scorePercent = paper.length ? Math.round((correctCount / paper.length) * 100) : 0;
    const passed = scorePercent >= course.entrancePassPercent;

    await this.prisma.entranceAttempt.update({
      where: { id: attempt.id },
      data: { answers: answers as Prisma.InputJsonValue, scorePercent, passed, submittedAt: new Date() },
    });
    if (passed && course.isFree) {
      await this.prisma.enrollment.upsert({
        where: { userId_courseId: { userId: user.userId, courseId: course.id } },
        create: { userId: user.userId, courseId: course.id },
        update: {},
      });
    }
    await this.audit.log({
      actorId: user.userId,
      action: passed ? 'entrance.passed' : 'entrance.failed',
      resource: 'course',
      resourceId: course.id,
      metadata: { scorePercent },
    });
    const status = await this.status(user, slug);
    return {
      scorePercent,
      passed,
      passPercent: course.entrancePassPercent,
      attemptsUsed: status.attemptsUsed,
      maxAttempts: course.entranceMaxAttempts,
      correctCount,
      total: paper.length,
    };
  }

  private async toPaper(attemptId: string, paper: PaperEntry[], passPercent: number): Promise<EntrancePaper> {
    const questions = await this.prisma.bankQuestion.findMany({
      where: { id: { in: paper.map((p) => p.questionId) } },
    });
    const byId = new Map(questions.map((q) => [q.id, q]));
    return {
      attemptId,
      passPercent,
      questions: paper.flatMap(({ questionId, optionOrder }) => {
        const q = byId.get(questionId);
        if (!q) return [];
        const options = q.options as StoredOption[];
        return [
          {
            id: q.id,
            text: q.text,
            allowMultiple: options.filter((o) => o.isCorrect).length > 1,
            // Correct answers never leave the server.
            options: optionOrder.filter((i) => options[i]).map((i) => ({ key: i, text: options[i]!.text })),
          },
        ];
      }),
    };
  }

  private async course(slug: string) {
    const course = await this.prisma.course.findFirst({ where: { slug, status: 'PUBLISHED' } });
    if (!course) throw new NotFoundException();
    return course;
  }
}
