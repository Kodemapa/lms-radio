import { type PrismaService } from '../prisma/prisma.service';
import { AccessService } from './access.service';

function setup(order: string[], completed: string[], previews: string[] = []) {
  const prisma = {
    lesson: {
      findMany: jest.fn(({ where }: { where: { isPreview?: boolean } }) =>
        Promise.resolve(where.isPreview ? previews.map((id) => ({ id })) : order.map((id) => ({ id }))),
      ),
    },
    lessonProgress: { findMany: jest.fn().mockResolvedValue(completed.map((lessonId) => ({ lessonId }))) },
  };
  return new AccessService(prisma as unknown as PrismaService);
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
});
