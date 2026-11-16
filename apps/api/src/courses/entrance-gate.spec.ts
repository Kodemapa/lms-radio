import { ForbiddenException } from '@nestjs/common';
import { type AuthUser } from '../auth/auth-user';
import { type PrismaService } from '../prisma/prisma.service';
import { AccessService } from './access.service';

const learner: AuthUser = { userId: 'u1', sessionId: 's', role: 'LEARNER' };
const instructor: AuthUser = { userId: 'i1', sessionId: 's', role: 'FACULTY' };

function setup({ passed = false, entrance = true }: { passed?: boolean; entrance?: boolean } = {}) {
  const course = { id: 'c1', slug: 'fm', title: 'FM', status: 'PUBLISHED', instructorId: 'i1', sequentialAccess: false, isFree: true, entranceTestEnabled: entrance };
  const enrolled = new Set<string>();
  const prisma = {
    lesson: {
      findUnique: jest.fn().mockResolvedValue({ id: 'l1', isPreview: true, courseId: 'c1', course }),
      findMany: jest.fn().mockResolvedValue([{ isPreview: true, course }]),
    },
    course: { findMany: jest.fn().mockResolvedValue([]) },
    assignmentSubmission: { findMany: jest.fn().mockResolvedValue([]) },
    imagingImage: { findMany: jest.fn().mockResolvedValue([]) },
    mediaAsset: { count: jest.fn().mockResolvedValue(0) },
    imagingAttempt: { findMany: jest.fn().mockResolvedValue([]) },
    imagingCase: { findMany: jest.fn().mockResolvedValue([]) },
    enrollment: {
      findUnique: jest.fn(({ where }: { where: { userId_courseId: { userId: string } } }) =>
        Promise.resolve(enrolled.has(where.userId_courseId.userId) ? {} : null),
      ),
      upsert: jest.fn(({ create }: { create: { userId: string } }) => {
        enrolled.add(create.userId);
        return Promise.resolve({});
      }),
    },
    entranceAttempt: { count: jest.fn().mockResolvedValue(passed ? 1 : 0) },
  };
  return new AccessService(prisma as unknown as PrismaService);
}

describe('entrance test gate', () => {
  it('blocks even free-preview lessons until the test is passed', async () => {
    await expect(setup().getAccessibleLesson(learner, 'l1')).rejects.toMatchObject({
      response: { code: 'ENTRANCE_REQUIRED' },
    });
  });

  it('blocks preview media until the test is passed', async () => {
    await expect(setup().assertAssetAccess(learner, 'a1')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('opens the course once the test is passed', async () => {
    await expect(setup({ passed: true }).getAccessibleLesson(learner, 'l1')).resolves.toMatchObject({ enrolled: true });
  });

  it('keeps free previews open on courses without an entrance test', async () => {
    await expect(setup({ entrance: false, passed: false }).getAccessibleLesson(learner, 'l1')).resolves.toBeDefined();
  });

  it("lets the course's instructor manage it without sitting the test", async () => {
    await expect(setup().getAccessibleLesson(instructor, 'l1')).resolves.toMatchObject({ manager: true });
  });
});
