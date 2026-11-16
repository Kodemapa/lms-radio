import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { findFetalSexDeterminationText, ReviewReplyInputSchema, ReviewReportInputSchema, type InstructorReview } from '@obgyn/types';
import { type Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { type AuthUser } from '../auth/auth-user';
import { zodOrThrow } from '../common/zod';
import { CoursePermissions } from '../courses/course-permissions';
import { PrismaService } from '../prisma/prisma.service';

export type ReviewFilter = 'all' | 'unanswered' | 'reported';

/**
 * Reviews of the courses I teach: reply publicly (owner/editor) or report a
 * review to admins (anyone on the course team). Admins hide reported reviews.
 */
@Injectable()
export class TeachingReviewsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly permissions: CoursePermissions,
    private readonly audit: AuditService,
  ) {}

  async list(user: AuthUser, { courseId, filter = 'all' }: { courseId?: string; filter?: ReviewFilter }): Promise<InstructorReview[]> {
    const ids = await this.permissions.courseIds(user, 'view');
    const where: Prisma.CourseReviewWhereInput = {
      ...(ids === null ? {} : { courseId: { in: ids } }),
      ...(courseId ? { courseId } : {}),
      ...(filter === 'unanswered' ? { reply: null } : filter === 'reported' ? { reportedAt: { not: null } } : {}),
    };
    if (courseId && ids !== null && !ids.includes(courseId)) return [];
    const rows = await this.prisma.courseReview.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 500,
      include: { user: { select: { displayName: true } }, course: { select: { title: true } } },
    });
    return rows.map((row) => ({
      userId: row.userId,
      courseId: row.courseId,
      courseTitle: row.course.title,
      authorName: row.user.displayName,
      rating: row.rating,
      comment: row.comment,
      createdAt: row.createdAt.toISOString(),
      reply: row.reply,
      repliedAt: row.repliedAt?.toISOString() ?? null,
      reportedAt: row.reportedAt?.toISOString() ?? null,
      reportReason: (row.reportReason as InstructorReview['reportReason']) ?? null,
      hidden: !!row.hiddenAt,
    }));
  }

  /** Sets (or clears, with null) the course team's public reply. */
  async reply(user: AuthUser, courseId: string, authorId: string, body: unknown): Promise<void> {
    await this.permissions.assert(user, courseId, 'edit');
    const { reply } = zodOrThrow(ReviewReplyInputSchema, body);
    if (reply && findFetalSexDeterminationText(reply).length) {
      throw new BadRequestException({ code: 'PCPNDT_BLOCKED', message: 'The reply refers to fetal sex' });
    }
    await this.review(courseId, authorId);
    await this.prisma.courseReview.update({
      where: { userId_courseId: { userId: authorId, courseId } },
      data: reply ? { reply, repliedAt: new Date(), repliedById: user.userId } : { reply: null, repliedAt: null, repliedById: null },
    });
    await this.audit.log({ actorId: user.userId, action: reply ? 'review.replied' : 'review.reply_removed', resource: 'course', resourceId: courseId, metadata: { authorId } });
  }

  async report(user: AuthUser, courseId: string, authorId: string, body: unknown): Promise<void> {
    await this.permissions.assert(user, courseId, 'view');
    const { reason } = zodOrThrow(ReviewReportInputSchema, body);
    await this.review(courseId, authorId);
    await this.prisma.courseReview.update({
      where: { userId_courseId: { userId: authorId, courseId } },
      data: { reportedAt: new Date(), reportReason: reason, reportedById: user.userId },
    });
    await this.audit.log({ actorId: user.userId, action: 'review.reported', resource: 'course', resourceId: courseId, metadata: { authorId, reason } });
  }

  private async review(courseId: string, authorId: string) {
    const row = await this.prisma.courseReview.findUnique({ where: { userId_courseId: { userId: authorId, courseId } } });
    if (!row) throw new NotFoundException();
    return row;
  }
}
