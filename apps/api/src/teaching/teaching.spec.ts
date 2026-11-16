import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { type CourseStudent } from '@obgyn/types';
import { type AuditService } from '../audit/audit.service';
import { type AuthUser } from '../auth/auth-user';
import { CoursePermissions } from '../courses/course-permissions';
import { type PrismaService } from '../prisma/prisma.service';
import { CollaboratorsService } from './collaborators.service';
import { countByDay, istDay, summariseAttempts, toStudentsCsv } from './insights.service';

const student = (over: Partial<CourseStudent> = {}): CourseStudent => ({
  userId: 'u1', displayName: 'Asha Rao', email: 'as***@x.in', enrolledAt: '2026-11-01T10:00:00.000Z', completedLessons: 3,
  totalLessons: 10, progressPercent: 30, lastActivityAt: null, entrancePassed: true, certificateSerial: null, ...over,
});

describe('students CSV', () => {
  it('starts with a BOM, quotes cells and neutralises formulas', () => {
    const csv = toStudentsCsv([student({ displayName: '=HYPERLINK("x")' }), student({ displayName: 'रवि "R" कुमार' })]);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    const lines = csv.slice(1).trim().split('\r\n');
    expect(lines[0]).toBe('"Name","Email","Enrolled","Completed lessons","Total lessons","Progress %","Last activity","Entrance passed","Certificate"');
    expect(lines[1]).toContain(`"'=HYPERLINK(""x"")"`);
    expect(lines[2]).toContain('"रवि ""R"" कुमार"');
    expect(lines[1]).toContain('"yes"');
  });
});

describe('analytics helpers', () => {
  it('counts days in India time, zero-filled, oldest first', () => {
    const now = new Date('2026-11-16T12:00:00Z');
    // 2026-11-15 20:00 UTC is already 16 Nov in IST
    const days = countByDay([new Date('2026-11-15T20:00:00Z'), new Date('2026-11-15T10:00:00Z')], 3, now);
    expect(days).toEqual([
      { date: '2026-11-14', count: 0 },
      { date: '2026-11-15', count: 1 },
      { date: '2026-11-16', count: 1 },
    ]);
    expect(istDay(new Date('2026-11-15T18:29:00Z'))).toBe('2026-11-15');
    expect(istDay(new Date('2026-11-15T18:31:00Z'))).toBe('2026-11-16');
  });

  it('summarises attempts per learner: best, last, passed if ever passed', () => {
    const t = (m: number) => new Date(Date.UTC(2026, 10, 1, 0, m));
    const rows = summariseAttempts(
      [
        { id: 'a1', userId: 'u1', scorePercent: 40, passed: false, createdAt: t(1) },
        { id: 'a2', userId: 'u1', scorePercent: 90, passed: true, createdAt: t(2) },
        { id: 'a3', userId: 'u1', scorePercent: 70, passed: true, createdAt: t(3) },
      ],
      new Map([['u1', 'Asha']]),
    );
    expect(rows).toEqual([
      { userId: 'u1', displayName: 'Asha', attempts: 3, bestScore: 90, lastScore: 70, passed: true, lastAttemptAt: t(3).toISOString(), lastAttemptId: 'a3' },
    ]);
  });
});

describe('co-instructor invitations', () => {
  const owner: AuthUser = { userId: 'owner', sessionId: 's', role: 'FACULTY' };
  function setup(invitee: { id: string; role: string } | null) {
    const prisma = {
      course: { findUnique: jest.fn().mockResolvedValue({ id: 'c1', instructorId: 'owner', status: 'DRAFT', title: 'T', slug: 't' }) },
      courseCollaborator: {
        findUnique: jest.fn().mockResolvedValue(null),
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
      },
      user: { findUnique: jest.fn().mockResolvedValue(invitee) },
    };
    const service = new CollaboratorsService(prisma as unknown as PrismaService, new CoursePermissions(prisma as unknown as PrismaService), { log: jest.fn() } as unknown as AuditService);
    return { service, prisma };
  }

  it('invites existing faculty', async () => {
    const { service, prisma } = setup({ id: 'f2', role: 'FACULTY' });
    await service.invite(owner, 'c1', { email: 'Dr.Two@Example.com', role: 'GRADER' });
    expect(prisma.user.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { email: 'dr.two@example.com' } }));
    expect(prisma.courseCollaborator.create).toHaveBeenCalledWith({ data: { courseId: 'c1', userId: 'f2', role: 'GRADER', invitedById: 'owner' } });
  });

  it('refuses learners and unknown emails with the same answer', async () => {
    await expect(setup({ id: 'l1', role: 'LEARNER' }).service.invite(owner, 'c1', { email: 'l@x.in', role: 'EDITOR' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(setup(null).service.invite(owner, 'c1', { email: 'nobody@x.in', role: 'EDITOR' })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('only the owner (or an admin) can invite', async () => {
    const other: AuthUser = { userId: 'f9', sessionId: 's', role: 'FACULTY' };
    await expect(setup({ id: 'f2', role: 'FACULTY' }).service.invite(other, 'c1', { email: 'a@x.in', role: 'EDITOR' })).rejects.toBeInstanceOf(ForbiddenException);
  });
});
