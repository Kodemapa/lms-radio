import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import {
  AdminReasonSchema,
  AdminReviewQuerySchema,
  type AdminReviewList,
} from '@obgyn/types';
import { type Prisma } from '@prisma/client';
import { AuditService } from '../../audit/audit.service';
import { type AuthUser } from '../../auth/auth-user';
import { zodOrThrow } from '../../common/zod';
import { PrismaService } from '../../prisma/prisma.service';
import { pageArgs, pageCount } from '../paging';

export type ReviewDecision = 'hide' | 'restore' | 'dismiss';

/**
 * Moderation queue for course reviews the course team reported. Hidden reviews disappear
 * from public pages and ratings (the author still sees their own); nothing is deleted.
 */
@Injectable()
export class AdminReviewsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(rawQuery: unknown): Promise<AdminReviewList> {
    const query = zodOrThrow(AdminReviewQuerySchema, rawQuery);
    const where: Prisma.CourseReviewWhereInput =
      query.status === 'REPORTED'
        ? { reportedAt: { not: null }, hiddenAt: null }
        : query.status === 'HIDDEN'
          ? { hiddenAt: { not: null } }
          : {};
    const [rows, total] = await Promise.all([
      this.prisma.courseReview.findMany({
        where,
        include: {
          user: { select: { displayName: true } },
          course: { select: { title: true, slug: true } },
        },
        orderBy: [{ reportedAt: { sort: 'asc', nulls: 'last' } }, { createdAt: 'asc' }],
        ...pageArgs(query.page, query.pageSize),
      }),
      this.prisma.courseReview.count({ where }),
    ]);
    const reporterIds = [...new Set(rows.map((row) => row.reportedById).filter((id): id is string => !!id))];
    const reporters = new Map(
      (await this.prisma.user.findMany({ where: { id: { in: reporterIds } }, select: { id: true, displayName: true } }))
        .map((user) => [user.id, user.displayName]),
    );
    return {
      items: rows.map((row) => ({
        courseId: row.courseId,
        courseTitle: row.course.title,
        courseSlug: row.course.slug,
        userId: row.userId,
        authorName: row.user.displayName,
        rating: row.rating,
        comment: row.comment,
        reply: row.reply,
        createdAt: row.createdAt.toISOString(),
        reportedAt: row.reportedAt?.toISOString() ?? null,
        reportReason: row.reportReason,
        reportedByName: row.reportedById ? (reporters.get(row.reportedById) ?? null) : null,
        hiddenAt: row.hiddenAt?.toISOString() ?? null,
      })),
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: pageCount(total, query.pageSize),
    };
  }

  async decide(admin: AuthUser, courseId: string, userId: string, decision: ReviewDecision, body: unknown): Promise<void> {
    const { reason } = zodOrThrow(AdminReasonSchema, body);
    const key = { userId_courseId: { userId, courseId } };
    const review = await this.prisma.courseReview.findUnique({ where: key });
    if (!review) throw new NotFoundException();

    let data: Prisma.CourseReviewUpdateInput;
    if (decision === 'hide') {
      if (review.hiddenAt) throw new ConflictException({ code: 'ALREADY_HIDDEN' });
      data = { hiddenAt: new Date() };
    } else if (decision === 'restore') {
      if (!review.hiddenAt) throw new ConflictException({ code: 'NOT_HIDDEN' });
      // Restoring is a decision on the report too, so the review leaves the queue.
      data = { hiddenAt: null, reportedAt: null, reportReason: null, reportedById: null };
    } else {
      if (!review.reportedAt) throw new ConflictException({ code: 'NOT_REPORTED' });
      if (review.hiddenAt) throw new ConflictException({ code: 'ALREADY_HIDDEN' });
      data = { reportedAt: null, reportReason: null, reportedById: null };
    }
    await this.prisma.courseReview.update({ where: key, data });
    await this.audit.log({
      actorId: admin.userId,
      action: `admin.review_${decision === 'hide' ? 'hidden' : decision === 'restore' ? 'restored' : 'report_dismissed'}`,
      resource: 'course_review',
      resourceId: `${courseId}:${userId}`,
      metadata: { courseId, authorId: userId, reason, reportReason: review.reportReason },
    });
  }
}
