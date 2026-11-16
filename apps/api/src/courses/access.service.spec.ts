import { CoursePermissions } from './course-permissions';
import { type PrismaService } from '../prisma/prisma.service';
import { AccessService } from './access.service';
import { fakeConfig } from '../test-utils';

function setup(order: string[], completed: string[], previews: string[] = [], config: Parameters<typeof fakeConfig>[0] = {}) {
  const prisma = {
    lesson: {
      findMany: jest.fn(({ where }: { where: { isPreview?: boolean } }) =>
        Promise.resolve(where.isPreview ? previews.map((id) => ({ id })) : order.map((id) => ({ id }))),
      ),
    },
    lessonProgress: { findMany: jest.fn().mockResolvedValue(completed.map((lessonId) => ({ lessonId }))) },
  };
  return new AccessService(
    prisma as unknown as PrismaService,
    new CoursePermissions(prisma as unknown as PrismaService),
    fakeConfig(config),
  );
}

describe('AccessService.lockedLessonIds (sequential access)', () => {
  it('unlocks only up to the first unfinished lesson', async () => {
    const locked = await setup(['a', 'b', 'c', 'd'], ['a']).lockedLessonIds('u', 'c1');
    expect([...locked]).toEqual(['c', 'd']);
  });

  it('locks nothing when everything is done', async () => {
    expect((await setup(['a', 'b'], ['a', 'b']).lockedLessonIds('u', 'c1')).size).toBe(0);
  });

  it('never locks free-preview lessons', async () => {
    const locked = await setup(['a', 'b', 'c'], [], ['c']).lockedLessonIds('u', 'c1');
    expect([...locked]).toEqual(['b']);
  });

  it('still blocks later lessons after a gap', async () => {
    const locked = await setup(['a', 'b', 'c'], ['a', 'c']).lockedLessonIds('u', 'c1');
    expect([...locked]).toEqual(['c']);
  });

  it('locks nothing when DEV_UNLOCK_LESSONS is on in development', async () => {
    const locked = await setup(['a', 'b', 'c'], [], [], { NODE_ENV: 'development', DEV_UNLOCK_LESSONS: true }).lockedLessonIds('u', 'c1');
    expect(locked.size).toBe(0);
  });

  it('keeps the locks in production even if DEV_UNLOCK_LESSONS slipped through', async () => {
    const locked = await setup(['a', 'b', 'c'], [], [], { NODE_ENV: 'production', DEV_UNLOCK_LESSONS: true }).lockedLessonIds('u', 'c1');
    expect([...locked]).toEqual(['b', 'c']);
  });
});
