import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  type AdminCreateInstructor,
  type AdminUserDetail,
  type AdminUserListItem,
  type AdminUserListResponse,
  type AdminUsersQuery,
  type Role,
} from '@obgyn/types';
import { AuditService } from '../../audit/audit.service';
import { type AuthUser } from '../../auth/auth-user';
import { hashPassword } from '../../common/password';
import { MailService } from '../../mail/mail.service';
import { instructorAccountEmail } from '../../mail/templates';
import { LIVE_LESSON } from '../../common/soft-delete';
import { PrismaService } from '../../prisma/prisma.service';
import { UsersService } from '../../users/users.service';
import { pageArgs, pageCount } from '../paging';

const USER_LIST_SELECT = {
  id: true,
  displayName: true,
  email: true,
  phone: true,
  role: true,
  createdAt: true,
  blockedAt: true,
  deletedAt: true,
} satisfies Prisma.UserSelect;

function maskEmail(email: string | null): string | null {
  if (!email) return null;
  const at = email.lastIndexOf('@');
  return at > 0 ? `${email[0]}***${email.slice(at)}` : `${email[0]}***`;
}

function maskPhone(phone: string | null): string | null {
  if (!phone) return null;
  const visible = phone.slice(-4);
  return `${'*'.repeat(Math.max(4, phone.length - visible.length))}${visible}`;
}

function userStatus(user: { blockedAt: Date | null; deletedAt: Date | null }): AdminUserListItem['status'] {
  if (user.deletedAt) return 'DELETED';
  return user.blockedAt ? 'BLOCKED' : 'ACTIVE';
}

@Injectable()
export class AdminUsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
    private readonly audit: AuditService,
    private readonly mail: MailService,
  ) {}

  async list(query: AdminUsersQuery): Promise<AdminUserListResponse> {
    const where: Prisma.UserWhereInput = {};
    const q = query.q.trim();
    if (q) {
      where.OR = [
        { displayName: { contains: q, mode: 'insensitive' } },
        { email: { contains: q, mode: 'insensitive' } },
        { phone: { contains: q, mode: 'insensitive' } },
      ];
    }
    if (query.role) where.role = query.role;
    if (query.status === 'ACTIVE') where.AND = [{ deletedAt: null }, { blockedAt: null }];
    if (query.status === 'BLOCKED') where.AND = [{ deletedAt: null }, { blockedAt: { not: null } }];
    if (query.status === 'DELETED') where.deletedAt = { not: null };

    const orderBy: Prisma.UserOrderByWithRelationInput[] = [
      query.sortBy === 'displayName' ? { displayName: query.order } : { createdAt: query.order },
      { id: 'asc' },
    ];
    const [rows, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        select: USER_LIST_SELECT,
        orderBy,
        ...pageArgs(query.page, query.pageSize),
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      items: rows.map((row) => ({
        ...row,
        email: maskEmail(row.email),
        phone: maskPhone(row.phone),
        status: userStatus(row),
        createdAt: row.createdAt.toISOString(),
        blockedAt: row.blockedAt?.toISOString() ?? null,
        deletedAt: row.deletedAt?.toISOString() ?? null,
      })),
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: pageCount(total, query.pageSize),
    };
  }

  async detail(id: string): Promise<AdminUserDetail> {
    const RECENT = 50;
    const [
      user,
      activity,
      progress,
      liveLessons,
      certificates,
      submissions,
      quizAttempts,
      entranceAttempts,
      reviews,
      roleChanges,
      applications,
      courseActivity,
      exams,
      imagingAttempts,
      teaching,
    ] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id },
        include: {
          blockedBy: { select: { displayName: true } },
          enrollments: {
            include: {
              course: { select: { title: true, slug: true, instructor: { select: { id: true, displayName: true } } } },
            },
            orderBy: { createdAt: 'desc' },
          },
          devices: { orderBy: { createdAt: 'desc' } },
        },
      }),
      this.prisma.auditLog.findMany({
        where: { OR: [{ actorId: id }, { resource: 'user', resourceId: id }] },
        select: { action: true, resource: true, resourceId: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
      this.prisma.lessonProgress.groupBy({
        by: ['courseId'],
        where: { userId: id, completedAt: { not: null }, lesson: LIVE_LESSON },
        _count: { _all: true },
      }),
      this.prisma.lesson.groupBy({
        by: ['courseId'],
        where: { course: { enrollments: { some: { userId: id } } }, ...LIVE_LESSON },
        _count: { _all: true },
      }),
      this.prisma.certificate.findMany({ where: { userId: id }, select: { courseId: true, serial: true } }),
      this.prisma.assignmentSubmission.findMany({
        where: { userId: id },
        orderBy: { updatedAt: 'desc' },
        take: RECENT,
        select: { status: true, updatedAt: true, course: { select: { title: true } }, lesson: { select: { title: true } } },
      }),
      this.prisma.quizAttempt.findMany({
        where: { userId: id },
        orderBy: { createdAt: 'desc' },
        take: RECENT,
        select: { scorePercent: true, passed: true, createdAt: true, lesson: { select: { title: true, course: { select: { title: true } } } } },
      }),
      this.prisma.entranceAttempt.findMany({
        where: { userId: id },
        orderBy: { startedAt: 'desc' },
        take: RECENT,
        select: { scorePercent: true, passed: true, startedAt: true, course: { select: { title: true } } },
      }),
      this.prisma.courseReview.findMany({
        where: { userId: id },
        orderBy: { createdAt: 'desc' },
        take: RECENT,
        select: { courseId: true, rating: true, comment: true, createdAt: true, reportedAt: true, hiddenAt: true, course: { select: { title: true } } },
      }),
      this.prisma.auditLog.findMany({
        where: { action: 'admin.user_role_changed', resource: 'user', resourceId: id },
        orderBy: { createdAt: 'desc' },
        select: { metadata: true, createdAt: true },
      }),
      this.prisma.instructorApplication.findMany({
        where: { userId: id },
        orderBy: { createdAt: 'desc' },
        select: { status: true, reviewNote: true, createdAt: true, reviewedAt: true },
      }),
      // Last activity and watch time per course.
      this.prisma.lessonProgress.groupBy({
        by: ['courseId'],
        where: { userId: id },
        _max: { updatedAt: true },
        _sum: { watchedSec: true },
      }),
      this.prisma.examSession.findMany({
        where: { userId: id },
        orderBy: { startedAt: 'desc' },
        take: RECENT,
        select: {
          status: true,
          reviewStatus: true,
          startedAt: true,
          submittedAt: true,
          quizAttemptId: true,
          lesson: { select: { title: true, course: { select: { title: true } } } },
        },
      }),
      this.prisma.imagingAttempt.findMany({
        where: { userId: id },
        orderBy: { createdAt: 'desc' },
        take: RECENT,
        select: { scorePercent: true, passed: true, createdAt: true, lesson: { select: { title: true, course: { select: { title: true } } } } },
      }),
      this.teaching(id),
    ]);
    if (!user) throw new NotFoundException();
    // Exam scores live on the quiz attempt each sitting produced.
    const examAttemptIds = exams.flatMap((exam) => (exam.quizAttemptId ? [exam.quizAttemptId] : []));
    const examScores = examAttemptIds.length
      ? await this.prisma.quizAttempt.findMany({
          where: { id: { in: examAttemptIds } },
          select: { id: true, scorePercent: true, passed: true },
        })
      : [];
    const examScoreBy = new Map(examScores.map((row) => [row.id, row]));
    const activityBy = new Map(courseActivity.map((row) => [row.courseId, row]));
    const doneBy = new Map(progress.map((row) => [row.courseId, row._count._all]));
    const totalBy = new Map(liveLessons.map((row) => [row.courseId, row._count._all]));
    const serialBy = new Map(certificates.map((row) => [row.courseId, row.serial]));
    const text = (value: unknown) => (typeof value === 'string' ? value : null);

    return {
      user: {
        id: user.id,
        displayName: user.displayName,
        email: user.email,
        phone: user.phone,
        headline: user.headline,
        bio: user.bio,
        learnerType: user.learnerType,
        role: user.role,
        createdAt: user.createdAt.toISOString(),
        blockedAt: user.blockedAt?.toISOString() ?? null,
        blockedReason: user.blockedReason,
        blockedByName: user.blockedBy?.displayName ?? null,
        deletedAt: user.deletedAt?.toISOString() ?? null,
      },
      enrollments: user.enrollments.map((enrollment) => ({
        courseId: enrollment.courseId,
        courseTitle: enrollment.course.title,
        courseSlug: enrollment.course.slug,
        enrolledAt: enrollment.createdAt.toISOString(),
        progress: { completed: doneBy.get(enrollment.courseId) ?? 0, total: totalBy.get(enrollment.courseId) ?? 0 },
        certificateSerial: serialBy.get(enrollment.courseId) ?? null,
        instructorId: enrollment.course.instructor?.id ?? null,
        instructorName: enrollment.course.instructor?.displayName ?? null,
        lastActivityAt: activityBy.get(enrollment.courseId)?._max.updatedAt?.toISOString() ?? null,
        watchedSec: activityBy.get(enrollment.courseId)?._sum.watchedSec ?? 0,
      })),
      learning: {
        submissions: submissions.map((row) => ({
          courseTitle: row.course.title,
          lessonTitle: row.lesson.title,
          status: row.status,
          updatedAt: row.updatedAt.toISOString(),
        })),
        quizAttempts: quizAttempts.map((row) => ({
          courseTitle: row.lesson.course.title,
          lessonTitle: row.lesson.title,
          scorePercent: row.scorePercent,
          passed: row.passed,
          createdAt: row.createdAt.toISOString(),
        })),
        entranceAttempts: entranceAttempts.map((row) => ({
          courseTitle: row.course.title,
          scorePercent: row.scorePercent,
          passed: row.passed,
          startedAt: row.startedAt.toISOString(),
        })),
        reviews: reviews.map((row) => ({
          courseId: row.courseId,
          courseTitle: row.course.title,
          rating: row.rating,
          comment: row.comment,
          createdAt: row.createdAt.toISOString(),
          reported: row.reportedAt !== null,
          hidden: row.hiddenAt !== null,
        })),
        exams: exams.map((row) => {
          const score = row.quizAttemptId ? examScoreBy.get(row.quizAttemptId) : undefined;
          return {
            courseTitle: row.lesson.course.title,
            lessonTitle: row.lesson.title,
            status: row.status,
            scorePercent: score?.scorePercent ?? null,
            passed: score?.passed ?? null,
            reviewStatus: row.reviewStatus,
            startedAt: row.startedAt.toISOString(),
            submittedAt: row.submittedAt?.toISOString() ?? null,
          };
        }),
        imagingAttempts: imagingAttempts.map((row) => ({
          courseTitle: row.lesson.course.title,
          lessonTitle: row.lesson.title,
          scorePercent: row.scorePercent,
          passed: row.passed,
          createdAt: row.createdAt.toISOString(),
        })),
      },
      // Someone who never taught (and isn't staff) has no teaching section.
      teaching: teaching.courses.length || user.role !== 'LEARNER' ? teaching : null,
      roleHistory: [
        ...roleChanges.map((row) => {
          const meta = (row.metadata ?? {}) as Record<string, unknown>;
          return { kind: 'ROLE_CHANGED' as const, from: text(meta.from), to: text(meta.to), status: null, note: text(meta.reason), at: row.createdAt.toISOString() };
        }),
        ...applications.map((row) => ({
          kind: 'APPLICATION' as const,
          from: null,
          to: null,
          status: row.status,
          note: row.reviewNote,
          at: (row.reviewedAt ?? row.createdAt).toISOString(),
        })),
      ].sort((a, b) => b.at.localeCompare(a.at)),
      devices: user.devices.map((device) => ({
        id: device.id,
        label: device.label,
        createdAt: device.createdAt.toISOString(),
        lastSeenAt: device.lastSeenAt.toISOString(),
        revokedAt: device.revokedAt?.toISOString() ?? null,
      })),
      activity: activity.map((entry) => ({
        action: entry.action,
        resource: entry.resource,
        resourceId: entry.resourceId,
        createdAt: entry.createdAt.toISOString(),
      })),
    };
  }

  /** Courses this user owns or co-teaches (accepted invitations), with their students. */
  private async teaching(id: string): Promise<NonNullable<AdminUserDetail['teaching']>> {
    const RECENT_STUDENTS = 50;
    const courses = await this.prisma.course.findMany({
      where: { OR: [{ instructorId: id }, { collaborators: { some: { userId: id, status: 'ACCEPTED' } } }] },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        title: true,
        slug: true,
        status: true,
        instructorId: true,
        collaborators: { where: { userId: id }, select: { role: true } },
        _count: { select: { enrollments: true, certificates: true } },
      },
    });
    const empty = { courses: 0, published: 0, students: 0, reviews: 0, averageRating: null, pendingGrading: 0, certificates: 0 };
    if (!courses.length) return { totals: empty, courses: [], students: [] };

    const courseIds = courses.map((course) => course.id);
    const inCourses = { courseId: { in: courseIds } };
    const [lessons, ratings, students, pendingAssignments, pendingWorking, recent] = await Promise.all([
      this.prisma.lesson.groupBy({ by: ['courseId'], where: { ...inCourses, ...LIVE_LESSON }, _count: { _all: true } }),
      this.prisma.courseReview.groupBy({
        by: ['courseId'],
        where: { ...inCourses, hiddenAt: null },
        _count: { _all: true },
        _avg: { rating: true },
      }),
      this.prisma.enrollment.groupBy({ by: ['userId'], where: inCourses }),
      this.prisma.assignmentSubmission.count({ where: { ...inCourses, status: 'SUBMITTED' } }),
      this.prisma.imagingAttempt.count({ where: { workingStatus: 'PENDING', lesson: inCourses } }),
      this.prisma.enrollment.findMany({
        where: inCourses,
        orderBy: { createdAt: 'desc' },
        take: RECENT_STUDENTS,
        select: {
          userId: true,
          courseId: true,
          createdAt: true,
          user: { select: { displayName: true } },
          course: { select: { title: true } },
        },
      }),
    ]);
    const recentProgress = recent.length
      ? await this.prisma.lessonProgress.groupBy({
          by: ['userId', 'courseId'],
          where: {
            ...inCourses,
            userId: { in: [...new Set(recent.map((row) => row.userId))] },
            completedAt: { not: null },
            lesson: LIVE_LESSON,
          },
          _count: { _all: true },
        })
      : [];

    const lessonsBy = new Map(lessons.map((row) => [row.courseId, row._count._all]));
    const ratingBy = new Map(ratings.map((row) => [row.courseId, row]));
    const doneBy = new Map(recentProgress.map((row) => [`${row.userId}:${row.courseId}`, row._count._all]));
    const round1 = (value: number | null | undefined) => (value == null ? null : Math.round(value * 10) / 10);
    const reviewCount = ratings.reduce((sum, row) => sum + row._count._all, 0);
    const ratingSum = ratings.reduce((sum, row) => sum + (row._avg.rating ?? 0) * row._count._all, 0);

    return {
      totals: {
        courses: courses.length,
        published: courses.filter((course) => course.status === 'PUBLISHED').length,
        students: students.length,
        reviews: reviewCount,
        averageRating: reviewCount ? round1(ratingSum / reviewCount) : null,
        pendingGrading: pendingAssignments + pendingWorking,
        certificates: courses.reduce((sum, course) => sum + course._count.certificates, 0),
      },
      courses: courses.map((course) => ({
        id: course.id,
        title: course.title,
        slug: course.slug,
        status: course.status,
        role: course.instructorId === id ? ('OWNER' as const) : (course.collaborators[0]?.role ?? 'EDITOR'),
        students: course._count.enrollments,
        lessons: lessonsBy.get(course.id) ?? 0,
        reviews: ratingBy.get(course.id)?._count._all ?? 0,
        averageRating: round1(ratingBy.get(course.id)?._avg.rating),
        certificates: course._count.certificates,
      })),
      students: recent.map((row) => ({
        userId: row.userId,
        displayName: row.user.displayName,
        courseTitle: row.course.title,
        enrolledAt: row.createdAt.toISOString(),
        progress: { completed: doneBy.get(`${row.userId}:${row.courseId}`) ?? 0, total: lessonsBy.get(row.courseId) ?? 0 },
      })),
    };
  }

  /**
   * Create an instructor (FACULTY) account with a temporary password the
   * admin shares privately. 409 PHONE_IN_USE / EMAIL_IN_USE if either is taken.
   */
  async createInstructor(admin: AuthUser, input: AdminCreateInstructor): Promise<{ id: string }> {
    const now = new Date();
    const email = input.email.trim().toLowerCase();
    const phone = input.phone.trim();
    // Say exactly which detail is taken, so the admin can fix the right field.
    const [phoneOwner, emailOwner] = await Promise.all([
      this.prisma.user.findUnique({ where: { phone }, select: { id: true } }),
      this.prisma.user.findUnique({ where: { email }, select: { id: true } }),
    ]);
    if (phoneOwner) throw inUse('PHONE_IN_USE');
    if (emailOwner) throw inUse('EMAIL_IN_USE');
    try {
      const user = await this.prisma.user.create({
        data: {
          displayName: input.displayName.trim(),
          email,
          phone,
          headline: input.headline?.trim() || null,
          role: 'FACULTY',
          passwordHash: await hashPassword(input.password),
          passwordChangedAt: now,
        },
        select: { id: true },
      });
      await this.audit.log({
        actorId: admin.userId,
        action: 'admin.instructor_created',
        resource: 'user',
        resourceId: user.id,
        metadata: { withPhone: true },
      });
      // The temporary password is never emailed; the admin shares it privately.
      this.mail.sendInBackground([instructorAccountEmail(input.email.trim().toLowerCase(), input.displayName.trim())]);
      return user;
    } catch (error) {
      // Taken by a request that raced this one: work out which field from the unique index.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const target = String((error.meta as { target?: unknown } | undefined)?.target ?? '');
        throw inUse(target.includes('phone') ? 'PHONE_IN_USE' : 'EMAIL_IN_USE');
      }
      throw error;
    }
  }

  async block(admin: AuthUser, id: string, reason: string): Promise<void> {
    await this.changeBlockedState(admin, id, reason, true);
    await this.audit.log({
      actorId: admin.userId,
      action: 'admin.user_blocked',
      resource: 'user',
      resourceId: id,
      metadata: { reason },
    });
  }

  async unblock(admin: AuthUser, id: string, reason: string): Promise<void> {
    await this.changeBlockedState(admin, id, reason, false);
    await this.audit.log({
      actorId: admin.userId,
      action: 'admin.user_unblocked',
      resource: 'user',
      resourceId: id,
      metadata: { reason },
    });
  }

  async changeRole(admin: AuthUser, id: string, role: Role, reason: string): Promise<void> {
    const previousRole = await this.prisma.$transaction(async (tx) => {
      await this.lockAdminChanges(tx);
      const target = await this.getTarget(tx, id);
      this.assertNotDeleted(target);
      if (target.role === role) throw new ConflictException({ code: 'ROLE_UNCHANGED' });
      if (id === admin.userId && target.role === 'ADMIN' && role !== 'ADMIN') {
        throw new ConflictException({ code: 'CANNOT_MANAGE_SELF' });
      }
      if (target.role === 'ADMIN' && role !== 'ADMIN') {
        await this.assertAdminRemains(tx, target);
      }

      await tx.user.update({ where: { id }, data: { role } });
      await tx.session.updateMany({
        where: { userId: id, revokedAt: null },
        data: { revokedAt: new Date(), revokedReason: 'ROLE_CHANGED' },
      });
      return target.role;
    });

    await this.audit.log({
      actorId: admin.userId,
      action: 'admin.user_role_changed',
      resource: 'user',
      resourceId: id,
      metadata: { from: previousRole, to: role, reason },
    });
  }

  async delete(admin: AuthUser, id: string, reason: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await this.lockAdminChanges(tx);
      const target = await this.getTarget(tx, id);
      if (id === admin.userId) throw new ConflictException({ code: 'CANNOT_MANAGE_SELF' });
      this.assertNotDeleted(target);
      if (target.role === 'ADMIN') await this.assertAdminRemains(tx, target);
      await this.users.eraseAccount(tx, id);
    });

    await this.audit.log({
      actorId: admin.userId,
      action: 'admin.user_deleted',
      resource: 'user',
      resourceId: id,
      metadata: { reason },
    });
  }

  private async changeBlockedState(
    admin: AuthUser,
    id: string,
    reason: string,
    blocked: boolean,
  ) {
    return this.prisma.$transaction(async (tx) => {
      await this.lockAdminChanges(tx);
      const target = await this.getTarget(tx, id);
      this.assertNotDeleted(target);
      if (blocked && id === admin.userId) throw new ConflictException({ code: 'CANNOT_MANAGE_SELF' });
      if (blocked && target.blockedAt) throw new ConflictException({ code: 'ALREADY_BLOCKED' });
      if (!blocked && !target.blockedAt) throw new ConflictException({ code: 'NOT_BLOCKED' });
      if (blocked && target.role === 'ADMIN') await this.assertAdminRemains(tx, target);

      const now = new Date();
      await tx.user.update({
        where: { id },
        data: blocked
          ? { blockedAt: now, blockedReason: reason, blockedById: admin.userId }
          : { blockedAt: null, blockedReason: null, blockedById: null },
      });
      if (blocked) {
        await tx.session.updateMany({
          where: { userId: id, revokedAt: null },
          data: { revokedAt: now, revokedReason: 'USER_BLOCKED' },
        });
      }
      return target;
    });
  }

  private getTarget(tx: Prisma.TransactionClient, id: string) {
    return tx.user.findUnique({
      where: { id },
      select: { id: true, role: true, blockedAt: true, deletedAt: true },
    }).then((user) => {
      if (!user) throw new NotFoundException();
      return user;
    });
  }

  private assertNotDeleted(target: { deletedAt: Date | null }): void {
    if (target.deletedAt) throw new ConflictException({ code: 'USER_DELETED' });
  }

  private async assertAdminRemains(
    tx: Prisma.TransactionClient,
    target: { role: string; blockedAt: Date | null; deletedAt: Date | null },
  ): Promise<void> {
    if (target.role !== 'ADMIN') return;
    const activeAdmins = await tx.user.count({
      where: { role: 'ADMIN', blockedAt: null, deletedAt: null },
    });
    const targetIsActive = !target.blockedAt && !target.deletedAt;
    if (activeAdmins - Number(targetIsActive) < 1) {
      throw new ConflictException({ code: 'LAST_ADMIN' });
    }
  }

  /**
   * Serialises admin user changes so two admins can't remove the last admin at once.
   * `$executeRaw`, not `$queryRaw`: pg_advisory_xact_lock returns `void`, which Prisma
   * cannot deserialise ("Failed to deserialize column of type 'void'").
   */
  private lockAdminChanges(tx: Prisma.TransactionClient): Promise<unknown> {
    return tx.$executeRaw`SELECT pg_advisory_xact_lock(1732050807)`;
  }
}

/** 409 naming the detail that already belongs to another account. */
function inUse(code: 'PHONE_IN_USE' | 'EMAIL_IN_USE'): ConflictException {
  return new ConflictException({
    code,
    message:
      code === 'PHONE_IN_USE'
        ? 'This mobile number is already in use by another account.'
        : 'This email address is already in use by another account.',
  });
}
