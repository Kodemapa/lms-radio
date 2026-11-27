import { ConflictException } from '@nestjs/common';
import { AdminUsersQuerySchema } from '@obgyn/types';
import { type AuditService } from '../../audit/audit.service';
import { type AuthUser } from '../../auth/auth-user';
import { type PrismaService } from '../../prisma/prisma.service';
import { type UsersService } from '../../users/users.service';
import { AdminUsersService } from './admin-users.service';
import { fakeMail } from '../../test-utils';

const ADMIN: AuthUser = {
  userId: '6f1c2a3b-0000-4000-8000-000000000001',
  sessionId: '6f1c2a3b-0000-4000-8000-000000000002',
  role: 'ADMIN',
};
const TARGET_ID = '6f1c2a3b-0000-4000-8000-000000000003';

function setup(targetOverrides: Record<string, unknown> = {}) {
  const target = {
    id: TARGET_ID,
    role: 'LEARNER',
    blockedAt: null,
    deletedAt: null,
    ...targetOverrides,
  };
  const tx = {
    $executeRaw: jest.fn().mockResolvedValue(1),
    user: {
      findUnique: jest.fn().mockResolvedValue(target),
      findMany: jest.fn(),
      count: jest.fn().mockResolvedValue(0),
      update: jest.fn().mockResolvedValue({}),
    },
    session: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
  };
  const prisma = {
    $transaction: jest.fn((work: (transaction: typeof tx) => Promise<unknown>) => work(tx)),
    user: {
      create: jest.fn().mockResolvedValue({ id: TARGET_ID }),
      // Nobody owns the email/mobile unless a test says so.
      findUnique: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([
        {
          id: TARGET_ID,
          displayName: 'Asha',
          email: 'asha@example.com',
          phone: '+919876543210',
          role: 'LEARNER',
          createdAt: new Date('2026-01-01T00:00:00.000Z'),
          blockedAt: null,
          deletedAt: null,
        },
      ]),
      count: jest.fn().mockResolvedValue(1),
    },
    auditLog: { findMany: jest.fn().mockResolvedValue([]) },
  };
  const users = { eraseAccount: jest.fn().mockResolvedValue(undefined) };
  const audit = { log: jest.fn().mockResolvedValue(undefined) };
  const service = new AdminUsersService(
    prisma as unknown as PrismaService,
    users as unknown as UsersService,
    audit as unknown as AuditService,
    fakeMail(),
  );
  return { service, prisma, tx, users, audit };
}

describe('AdminUsersService', () => {
  it('creates an instructor with a password hash and audits without exposing the password', async () => {
    const { service, prisma, audit } = setup();
    const password = 'Temporary1pass';

    await service.createInstructor(ADMIN, {
      displayName: ' Dr Asha Rao ',
      email: 'ASHA@EXAMPLE.COM ',
      phone: '+919812345678',
      headline: 'Fetal medicine',
      password,
    });

    const create = prisma.user.create.mock.calls[0]?.[0];
    expect(create).toMatchObject({
      data: {
        displayName: 'Dr Asha Rao',
        email: 'asha@example.com',
        phone: '+919812345678',
        role: 'FACULTY',
      },
      select: { id: true },
    });
    expect(create?.data.passwordHash).toMatch(/^scrypt\$/);
    expect(JSON.stringify(create?.data)).not.toContain(password);
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'admin.instructor_created', resourceId: TARGET_ID }),
    );
    expect(JSON.stringify(audit.log.mock.calls)).not.toContain(password);
  });

  it.each([
    ['mobile', { phone: '+919812345678' }, 'PHONE_IN_USE'],
    ['email', { email: 'asha@example.com' }, 'EMAIL_IN_USE'],
  ])('refuses an instructor whose %s is already registered, naming that field', async (_label, where, code) => {
    const { service, prisma } = setup();
    prisma.user.findUnique.mockImplementation(async (args: { where: Record<string, string> }) =>
      Object.entries(where).every(([key, value]) => args.where[key] === value) ? { id: 'someone-else' } : null,
    );
    await expect(
      service.createInstructor(ADMIN, {
        displayName: 'Dr Asha Rao',
        email: 'asha@example.com',
        phone: '+919812345678',
        password: 'Temporary1pass',
      }),
    ).rejects.toMatchObject({ status: 409, response: { code } });
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it('masks contact details in the paged user list', async () => {
    const { service, prisma } = setup();
    const result = await service.list(AdminUsersQuerySchema.parse({}));

    expect(result.items[0]).toMatchObject({
      email: 'a***@example.com',
      phone: '*********3210',
      status: 'ACTIVE',
    });
    expect(result.items[0]?.email).not.toContain('asha');
    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { AND: [{ deletedAt: null }, { blockedAt: null }] } }),
    );
  });

  it('blocks a user, revokes sessions, and writes an audit entry', async () => {
    const { service, tx, audit } = setup();
    await service.block(ADMIN, TARGET_ID, 'Policy violation');

    expect(tx.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: TARGET_ID }, data: expect.objectContaining({ blockedReason: 'Policy violation' }) }),
    );
    expect(tx.session.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: TARGET_ID, revokedAt: null }, data: expect.objectContaining({ revokedReason: 'USER_BLOCKED' }) }),
    );
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'admin.user_blocked', actorId: ADMIN.userId, resourceId: TARGET_ID }),
    );
  });

  it.each(['block', 'role', 'delete'] as const)('prevents removing the last admin by %s', async (action) => {
    const { service, tx, users, audit } = setup({ role: 'ADMIN' });
    tx.user.count.mockResolvedValue(1);

    const request = action === 'block'
      ? service.block(ADMIN, TARGET_ID, 'Policy violation')
      : action === 'role'
        ? service.changeRole(ADMIN, TARGET_ID, 'FACULTY', 'Role correction')
        : service.delete(ADMIN, TARGET_ID, 'Duplicate account');
    await expect(request).rejects.toBeInstanceOf(ConflictException);
    expect(tx.user.update).not.toHaveBeenCalled();
    expect(users.eraseAccount).not.toHaveBeenCalled();
    expect(audit.log).not.toHaveBeenCalled();
  });

  it('does not let an administrator block their own account', async () => {
    const { service, tx } = setup({ id: ADMIN.userId, role: 'ADMIN' });

    await expect(service.block(ADMIN, ADMIN.userId, 'Test')).rejects.toBeInstanceOf(ConflictException);
    expect(tx.user.update).not.toHaveBeenCalled();
  });
});

describe('AdminUsersService.detail', () => {
  const FACULTY_ID = '6f1c2a3b-0000-4000-8000-000000000010';
  const COURSE_A = '6f1c2a3b-0000-4000-8000-0000000000a1';
  const COURSE_B = '6f1c2a3b-0000-4000-8000-0000000000b1';
  const STUDENT = '6f1c2a3b-0000-4000-8000-000000000020';
  const at = new Date('2026-03-01T10:00:00.000Z');

  function detailSetup(role: 'LEARNER' | 'FACULTY', taught: unknown[]) {
    const lessonGroupBy = jest.fn(async (args: { by: string[] }) =>
      args.by.includes('userId') ? [] : [{ courseId: COURSE_A, _count: { _all: 4 } }, { courseId: COURSE_B, _count: { _all: 2 } }],
    );
    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: FACULTY_ID, displayName: 'Dr Rao', email: null, phone: null, headline: null, bio: null, learnerType: null,
          role, createdAt: at, blockedAt: null, blockedReason: null, blockedBy: null, deletedAt: null, devices: [],
          enrollments: [{ courseId: COURSE_B, createdAt: at, course: { title: 'Doppler', slug: 'doppler', instructor: { id: STUDENT, displayName: 'Dr Sen' } } }],
        }),
      },
      auditLog: { findMany: jest.fn().mockResolvedValue([]) },
      lessonProgress: {
        groupBy: jest.fn(async (args: { by: string[]; _max?: unknown }) => {
          if (args._max) return [{ courseId: COURSE_B, _max: { updatedAt: at }, _sum: { watchedSec: 600 } }];
          if (args.by.includes('userId')) return [{ userId: STUDENT, courseId: COURSE_A, _count: { _all: 3 } }];
          return [{ courseId: COURSE_B, _count: { _all: 1 } }];
        }),
      },
      lesson: { groupBy: lessonGroupBy },
      certificate: { findMany: jest.fn().mockResolvedValue([]) },
      assignmentSubmission: { findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(2) },
      quizAttempt: {
        // The history list (no id filter) is empty; the exam's own attempt carries the score.
        findMany: jest.fn(async (args: { where: { id?: unknown } }) => (args.where.id ? [{ id: 'qa1', scorePercent: 80, passed: true }] : [])),
      },
      entranceAttempt: { findMany: jest.fn().mockResolvedValue([]) },
      courseReview: {
        findMany: jest.fn().mockResolvedValue([]),
        groupBy: jest.fn().mockResolvedValue([
          { courseId: COURSE_A, _count: { _all: 3 }, _avg: { rating: 4 } },
          { courseId: COURSE_B, _count: { _all: 1 }, _avg: { rating: 5 } },
        ]),
      },
      instructorApplication: { findMany: jest.fn().mockResolvedValue([]) },
      examSession: {
        findMany: jest.fn().mockResolvedValue([
          { status: 'SUBMITTED', reviewStatus: 'CLEARED', startedAt: at, submittedAt: at, quizAttemptId: 'qa1', lesson: { title: 'Final exam', course: { title: 'Doppler' } } },
        ]),
      },
      imagingAttempt: { findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(1) },
      course: { findMany: jest.fn().mockResolvedValue(taught) },
      enrollment: {
        groupBy: jest.fn().mockResolvedValue([{ userId: STUDENT }, { userId: FACULTY_ID }]),
        findMany: jest.fn().mockResolvedValue([
          { userId: STUDENT, courseId: COURSE_A, createdAt: at, user: { displayName: 'Asha' }, course: { title: 'Biometry' } },
        ]),
      },
    };
    const service = new AdminUsersService(prisma as unknown as PrismaService, {} as UsersService, {} as AuditService, fakeMail());
    return { service, prisma };
  }

  const taught = [
    { id: COURSE_A, title: 'Biometry', slug: 'biometry', status: 'PUBLISHED', instructorId: FACULTY_ID, collaborators: [], _count: { enrollments: 5, certificates: 2 } },
    { id: COURSE_B, title: 'Doppler', slug: 'doppler', status: 'DRAFT', instructorId: STUDENT, collaborators: [{ role: 'GRADER' }], _count: { enrollments: 1, certificates: 0 } },
  ];

  it('shows each enrolment with its instructor, activity and watch time, and exams with their score', async () => {
    const { service } = detailSetup('LEARNER', []);
    const detail = await service.detail(FACULTY_ID);
    expect(detail.enrollments[0]).toMatchObject({
      instructorName: 'Dr Sen',
      progress: { completed: 1, total: 2 },
      lastActivityAt: at.toISOString(),
      watchedSec: 600,
    });
    expect(detail.learning.exams[0]).toMatchObject({ lessonTitle: 'Final exam', scorePercent: 80, passed: true, reviewStatus: 'CLEARED' });
    expect(detail.teaching).toBeNull();
  });

  it('summarises what an instructor teaches: courses, distinct students, ratings, grading queue, recent students', async () => {
    const { service } = detailSetup('FACULTY', taught);
    const teaching = (await service.detail(FACULTY_ID)).teaching!;
    expect(teaching.totals).toEqual({
      courses: 2, published: 1, students: 2, reviews: 4, averageRating: 4.3, pendingGrading: 3, certificates: 2,
    });
    expect(teaching.courses.map((course) => course.role)).toEqual(['OWNER', 'GRADER']);
    expect(teaching.courses[0]).toMatchObject({ students: 5, lessons: 4, averageRating: 4 });
    expect(teaching.students[0]).toMatchObject({ displayName: 'Asha', progress: { completed: 3, total: 4 } });
  });

  it('gives staff an empty teaching section rather than none', async () => {
    const { service } = detailSetup('FACULTY', []);
    expect((await service.detail(FACULTY_ID)).teaching).toMatchObject({ totals: { courses: 0, students: 0 }, courses: [] });
  });
});
