import { Injectable } from '@nestjs/common';
import { COURSE_STATUSES, type AdminStats } from '@obgyn/types';
import { PrismaService } from '../../prisma/prisma.service';
import { countByDay } from '../../teaching/insights.service';

const DAYS = 30;
const DAY_MS = 86_400_000;

/**
 * Platform totals for the admin dashboard, counted fresh on every request so a change
 * (e.g. a learner promoted to instructor) shows at once. The queries are indexed counts,
 * and only admins call this. Revenue figures arrive with commerce (COM-*).
 */
@Injectable()
export class AdminStatsService {
  constructor(private readonly prisma: PrismaService) {}

  get(now = Date.now()): Promise<AdminStats> {
    return this.compute(new Date(now));
  }

  private async compute(now: Date): Promise<AdminStats> {
    const since = new Date(now.getTime() - DAYS * DAY_MS);
    const alive = { deletedAt: null };
    const [
      learners,
      instructors,
      admins,
      blocked,
      newUsers,
      courseGroups,
      enrolments,
      recentEnrolments,
      certificates,
      recentCertificates,
      applications,
      courseReviews,
      reportedReviews,
      failedVideos,
      signupDates,
    ] = await Promise.all([
      this.prisma.user.count({ where: { ...alive, role: 'LEARNER' } }),
      this.prisma.user.count({ where: { ...alive, role: 'FACULTY' } }),
      this.prisma.user.count({ where: { ...alive, role: 'ADMIN' } }),
      this.prisma.user.count({ where: { ...alive, blockedAt: { not: null } } }),
      this.prisma.user.count({ where: { ...alive, createdAt: { gte: since } } }),
      this.prisma.course.groupBy({ by: ['status'], _count: { _all: true } }),
      this.prisma.enrollment.count(),
      this.prisma.enrollment.findMany({ where: { createdAt: { gte: since } }, select: { createdAt: true } }),
      this.prisma.certificate.count(),
      this.prisma.certificate.count({ where: { issuedAt: { gte: since } } }),
      this.prisma.instructorApplication.count({ where: { status: 'PENDING' } }),
      this.prisma.course.count({ where: { status: 'IN_REVIEW' } }),
      this.prisma.courseReview.count({ where: { reportedAt: { not: null }, hiddenAt: null } }),
      this.prisma.drmPackage.count({ where: { status: 'FAILED' } }),
      this.prisma.user.findMany({ where: { createdAt: { gte: since } }, select: { createdAt: true } }),
    ]);

    const courses = Object.fromEntries(COURSE_STATUSES.map((status) => [status, 0])) as AdminStats['courses'];
    for (const group of courseGroups) courses[group.status] = group._count._all;

    return {
      users: { learners, instructors, admins, blocked, newLast30Days: newUsers },
      courses,
      enrolments: { total: enrolments, last30Days: recentEnrolments.length },
      certificates: { total: certificates, last30Days: recentCertificates },
      pending: { applications, courseReviews, reportedReviews, failedVideos },
      daily: {
        enrolments: countByDay(recentEnrolments.map((row) => row.createdAt), DAYS, now),
        signups: countByDay(signupDates.map((row) => row.createdAt), DAYS, now),
      },
      generatedAt: now.toISOString(),
    };
  }
}
