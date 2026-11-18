import { type PrismaService } from '../../prisma/prisma.service';
import { AdminStatsService } from './admin-stats.service';

/** A fake database where the learner and instructor counts can change between requests. */
function setup() {
  const counts = { LEARNER: 10, FACULTY: 2, ADMIN: 1 };
  const userCount = jest.fn(async ({ where }: { where: { role?: keyof typeof counts } }) =>
    where.role ? counts[where.role] : 0,
  );
  const prisma = {
    user: { count: userCount, findMany: jest.fn().mockResolvedValue([]) },
    course: { groupBy: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0) },
    enrollment: { count: jest.fn().mockResolvedValue(0), findMany: jest.fn().mockResolvedValue([]) },
    certificate: { count: jest.fn().mockResolvedValue(0) },
    instructorApplication: { count: jest.fn().mockResolvedValue(0) },
    courseReview: { count: jest.fn().mockResolvedValue(0) },
    drmPackage: { count: jest.fn().mockResolvedValue(0) },
  };
  return { service: new AdminStatsService(prisma as unknown as PrismaService), counts };
}

describe('AdminStatsService', () => {
  it('reflects a role change on the very next request (no stale cache)', async () => {
    const { service, counts } = setup();
    const before = await service.get();
    expect(before.users).toMatchObject({ learners: 10, instructors: 2 });

    // A learner is promoted to instructor.
    counts.LEARNER -= 1;
    counts.FACULTY += 1;

    const after = await service.get();
    expect(after.users).toMatchObject({ learners: 9, instructors: 3 });
  });
});
