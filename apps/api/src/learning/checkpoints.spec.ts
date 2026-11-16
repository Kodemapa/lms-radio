import { type ImagingService } from '../imaging/imaging.service';
import { ConflictException } from '@nestjs/common';
import { type AuditService } from '../audit/audit.service';
import { type AuthUser } from '../auth/auth-user';
import { type AccessService } from '../courses/access.service';
import { type PrismaService } from '../prisma/prisma.service';
import { LearningService } from './learning.service';

const user: AuthUser = { userId: 'u1', sessionId: 's1', role: 'LEARNER' };
const LESSON = { id: 'l1', kind: 'VIDEO', courseId: 'c1' };
const Q30 = { id: 'q30', atSec: 30, text: 'A?', explanation: 'because', allowMultiple: false, options: [{ id: 'a', text: 'a', isCorrect: true }, { id: 'b', text: 'b', isCorrect: false }] };
const Q90 = { id: 'q90', atSec: 90, text: 'B?', explanation: null, allowMultiple: false, options: [{ id: 'c', text: 'c', isCorrect: true }, { id: 'd', text: 'd', isCorrect: false }] };

function setup(passed: string[], previous: { positionSec: number; furthestSec: number; updatedAt: Date } | null = null) {
  const passedSet = new Set(passed);
  const prisma = {
    quizQuestion: {
      findMany: jest.fn().mockResolvedValue([Q30, Q90]),
      findFirst: jest.fn(({ where }: { where: { id: string } }) => Promise.resolve([Q30, Q90].find((q) => q.id === where.id) ?? null)),
    },
    checkpointAnswer: {
      findMany: jest.fn(() => Promise.resolve([...passedSet].map((questionId) => ({ questionId })))),
      upsert: jest.fn(({ create, update }: { create: { questionId: string; passedAt: Date | null }; update: { passedAt?: Date } }) => {
        if (create.passedAt || update.passedAt) passedSet.add(create.questionId);
        return Promise.resolve({ attempts: 1 });
      }),
    },
    lessonProgress: { upsert: jest.fn().mockResolvedValue({}), findUnique: jest.fn().mockResolvedValue(previous) },
  };
  const access = { getAccessibleLesson: jest.fn().mockResolvedValue({ lesson: LESSON, enrolled: true, manager: false }) };
  const service = new LearningService(
    prisma as unknown as PrismaService,
    access as unknown as AccessService,
    { log: jest.fn() } as unknown as AuditService,
    {} as unknown as ImagingService,
  );
  return { service, prisma };
}

describe('in-video questions', () => {
  it('refuses to complete the video while a question is unanswered', async () => {
    const { service, prisma } = setup(['q30']);
    await expect(service.updateProgress(user, 'l1', { completed: true })).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.lessonProgress.upsert).not.toHaveBeenCalled();
  });

  it('never saves a position past the next unanswered question', async () => {
    const { service, prisma } = setup([]);
    await service.updateProgress(user, 'l1', { positionSec: 120 });
    expect(prisma.lessonProgress.upsert.mock.calls[0][0].create.positionSec).toBe(30);
  });

  it('allows completion once every question is answered', async () => {
    const { service, prisma } = setup(['q30', 'q90']);
    await service.updateProgress(user, 'l1', { completed: true, positionSec: 130 });
    expect(prisma.lessonProgress.upsert.mock.calls[0][0].create).toMatchObject({ positionSec: 130 });
  });

  it('a wrong answer keeps the lock and hides the explanation', async () => {
    const { service } = setup([]);
    await expect(service.answerCheckpoint(user, 'l1', 'q30', ['b'])).resolves.toMatchObject({
      correct: false,
      explanation: null,
      unlockedUntilSec: 30,
    });
  });

  it('a right answer moves the lock to the next question', async () => {
    const { service } = setup([]);
    await expect(service.answerCheckpoint(user, 'l1', 'q30', ['a'])).resolves.toMatchObject({
      correct: true,
      explanation: 'because',
      unlockedUntilSec: 90,
    });
  });

  it('adds watch time for forward playback, capped by real time, and counts views', async () => {
    const { service, prisma } = setup(['q30', 'q90'], { positionSec: 40, furthestSec: 40, updatedAt: new Date(Date.now() - 10_000) });
    await service.updateProgress(user, 'l1', { positionSec: 600, opened: true });
    const { update } = prisma.lessonProgress.upsert.mock.calls[0][0];
    expect(update.watchedSec.increment).toBeLessThanOrEqual(16); // 10 s elapsed + slack, not the 560 s seek
    expect(update.furthestSec).toBe(600);
    expect(update.views).toEqual({ increment: 1 });
  });
});
