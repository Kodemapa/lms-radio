import { ConflictException, ForbiddenException } from '@nestjs/common';
import { type AuditService } from '../audit/audit.service';
import { type AuthUser } from '../auth/auth-user';
import { type PrismaService } from '../prisma/prisma.service';
import { fakeConfig } from '../test-utils';
import { EntranceService } from './entrance.service';

const user: AuthUser = { userId: 'u1', sessionId: 's', role: 'LEARNER' };
const POOL = Array.from({ length: 6 }, (_, i) => ({
  id: `00000000-0000-4000-8000-00000000000${i}`,
  text: `Q${i}`,
  options: [
    { text: 'right', isCorrect: true },
    { text: 'wrong', isCorrect: false },
    { text: 'also wrong', isCorrect: false },
  ],
}));

function setup({
  maxAttempts = null as number | null,
  attempts = [] as Record<string, unknown>[],
  production = false,
} = {}) {
  const store = [...attempts];
  const prisma = {
    course: {
      findFirst: jest.fn().mockResolvedValue({
        id: 'c1',
        isFree: true,
        entranceTestEnabled: true,
        entranceQuestionCount: 4,
        entrancePassPercent: 75,
        entranceMaxAttempts: maxAttempts,
        entranceTopic: null,
      }),
    },
    entranceAttempt: {
      findMany: jest.fn(() => Promise.resolve([...store].reverse())),
      findUnique: jest.fn(({ where }: { where: { id: string } }) => Promise.resolve(store.find((a) => a.id === where.id) ?? null)),
      findUniqueOrThrow: jest.fn(({ where }: { where: { id: string } }) => Promise.resolve(store.find((a) => a.id === where.id))),
      create: jest.fn(({ data }: { data: Record<string, unknown> }) => {
        const row = { id: `a${store.length}`, startedAt: new Date(), submittedAt: null, passed: null, ...data };
        store.push(row);
        return Promise.resolve(row);
      }),
      update: jest.fn(({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        Object.assign(store.find((a) => a.id === where.id)!, data);
        return Promise.resolve({});
      }),
      updateMany: jest.fn(({ data }: { data: Record<string, unknown> }) => {
        store.filter((a) => !a.submittedAt).forEach((a) => Object.assign(a, data));
        return Promise.resolve({ count: 1 });
      }),
    },
    bankQuestion: {
      findMany: jest.fn(({ where }: { where: { id?: { in: string[] } } }) =>
        Promise.resolve(where.id ? POOL.filter((q) => where.id!.in.includes(q.id)) : POOL),
      ),
    },
    enrollment: { upsert: jest.fn().mockResolvedValue({}) },
  };
  const service = new EntranceService(
    prisma as unknown as PrismaService,
    { log: jest.fn() } as unknown as AuditService,
    fakeConfig({ NODE_ENV: production ? 'production' : 'development' }),
  );
  return { service, prisma, store };
}

describe('EntranceService', () => {
  it('draws the configured number of distinct questions and never sends answers', async () => {
    const { service } = setup();
    const paper = await service.start(user, 'course');
    expect(paper.questions).toHaveLength(4);
    expect(new Set(paper.questions.map((q) => q.id)).size).toBe(4);
    expect(JSON.stringify(paper)).not.toContain('isCorrect');
  });

  it('marks by original option key, whatever the shuffled order', async () => {
    const { service, prisma } = setup();
    const paper = await service.start(user, 'course');
    const answers = Object.fromEntries(paper.questions.map((q, i) => [q.id, [i < 3 ? 0 : 1]])); // 3 of 4 right
    const result = await service.submit(user, 'course', paper.attemptId, answers);
    expect(result).toMatchObject({ scorePercent: 75, passed: true, correctCount: 3, total: 4 });
    expect(prisma.enrollment.upsert).toHaveBeenCalled(); // free course: enrolled on passing
  });

  it('fails below the pass mark without enrolling', async () => {
    const { service, prisma } = setup();
    const paper = await service.start(user, 'course');
    const result = await service.submit(user, 'course', paper.attemptId, {});
    expect(result.passed).toBe(false);
    expect(prisma.enrollment.upsert).not.toHaveBeenCalled();
  });

  it('resumes an unfinished attempt instead of drawing a new paper', async () => {
    const { service } = setup();
    const first = await service.start(user, 'course');
    const again = await service.start(user, 'course');
    expect(again.attemptId).toBe(first.attemptId);
    expect(again.questions.map((q) => q.id)).toEqual(first.questions.map((q) => q.id));
  });

  it('enforces the attempt limit', async () => {
    const used = { id: 'old', userId: 'u1', courseId: 'c1', paper: [], startedAt: new Date(0), submittedAt: new Date(0), passed: false, scorePercent: 10 };
    const { service } = setup({ maxAttempts: 1, attempts: [used] });
    await expect(service.start(user, 'course')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('does not let a passed learner sit it again', async () => {
    const passed = { id: 'p', userId: 'u1', courseId: 'c1', paper: [], startedAt: new Date(0), submittedAt: new Date(0), passed: true, scorePercent: 90 };
    const { service } = setup({ attempts: [passed] });
    await expect(service.start(user, 'course')).rejects.toBeInstanceOf(ConflictException);
  });

  it('dev skip marks the test passed and enrols, in development', async () => {
    const { service, prisma } = setup();
    await expect(service.devSkip(user, 'course')).resolves.toMatchObject({ passed: true });
    expect(prisma.enrollment.upsert).toHaveBeenCalled();
  });

  it('dev skip is refused in production', async () => {
    const { service, prisma } = setup({ production: true });
    await expect(service.devSkip(user, 'course')).rejects.toMatchObject({ response: { code: 'DEV_ONLY' } });
    expect(prisma.entranceAttempt.create).not.toHaveBeenCalled();
  });
});
