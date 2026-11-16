import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { type CertificatePublic, type CourseSummary, type Review, type ReviewList } from '@obgyn/types';
import { AuditService } from '../audit/audit.service';
import { type AuthUser } from '../auth/auth-user';
import { AccessService } from '../courses/access.service';
import { COURSE_SUMMARY_INCLUDE, toCourseSummary } from '../courses/course-mapper';
import { BankService } from '../authoring/bank.service';
import { PrismaService } from '../prisma/prisma.service';
import { type ReviewDto } from './dto';

/** Reviews, wishlist and public certificate verification. */
@Injectable()
export class EngagementService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
    private readonly audit: AuditService,
    private readonly bank: BankService,
  ) {}

  async reviews(slug: string, viewerId?: string): Promise<ReviewList> {
    const course = await this.publishedCourse(slug);
    const rows = await this.prisma.courseReview.findMany({
      where: { courseId: course.id },
      orderBy: { updatedAt: 'desc' },
      include: { user: { select: { displayName: true } } },
      take: 100,
    });
    const distribution = [0, 0, 0, 0, 0];
    for (const row of rows) distribution[row.rating - 1]! += 1;
    const items: Review[] = rows.map((row) => ({
      rating: row.rating,
      comment: row.comment,
      authorName: row.user.displayName,
      updatedAt: row.updatedAt.toISOString(),
      mine: row.userId === viewerId,
    }));
    return {
      average: rows.length ? Math.round((rows.reduce((s, r) => s + r.rating, 0) / rows.length) * 10) / 10 : null,
      count: rows.length,
      distribution,
      items,
    };
  }

  /** Only enrolled learners can review, one review each (editable). */
  async upsertReview(user: AuthUser, slug: string, dto: ReviewDto): Promise<void> {
    const course = await this.publishedCourse(slug);
    if (!(await this.access.isEnrolled(user.userId, course.id))) {
      throw new ForbiddenException({ code: 'NOT_ENROLLED' });
    }
    const data = { rating: dto.rating, comment: dto.comment?.trim() || null };
    await this.prisma.courseReview.upsert({
      where: { userId_courseId: { userId: user.userId, courseId: course.id } },
      create: { ...data, userId: user.userId, courseId: course.id },
      update: data,
    });
  }

  async deleteReview(user: AuthUser, slug: string): Promise<void> {
    const course = await this.publishedCourse(slug);
    await this.prisma.courseReview.deleteMany({ where: { userId: user.userId, courseId: course.id } });
  }

  async wishlist(user: AuthUser): Promise<CourseSummary[]> {
    const items = await this.prisma.wishlistItem.findMany({
      where: { userId: user.userId, course: { status: 'PUBLISHED' } },
      orderBy: { createdAt: 'desc' },
      include: { course: { include: COURSE_SUMMARY_INCLUDE } },
    });
    return items.map((item) => toCourseSummary(item.course));
  }

  async wishlistIds(user: AuthUser): Promise<string[]> {
    const items = await this.prisma.wishlistItem.findMany({ where: { userId: user.userId }, select: { courseId: true } });
    return items.map((item) => item.courseId);
  }

  async addToWishlist(user: AuthUser, courseId: string): Promise<void> {
    const course = await this.prisma.course.findFirst({ where: { id: courseId, status: 'PUBLISHED' } });
    if (!course) throw new NotFoundException();
    await this.prisma.wishlistItem.upsert({
      where: { userId_courseId: { userId: user.userId, courseId } },
      create: { userId: user.userId, courseId },
      update: {},
    });
  }

  async removeFromWishlist(user: AuthUser, courseId: string): Promise<void> {
    await this.prisma.wishlistItem.deleteMany({ where: { userId: user.userId, courseId } });
  }

  async certificate(serial: string): Promise<CertificatePublic> {
    const row = await this.prisma.certificate.findUnique({
      where: { serial },
      include: {
        user: { select: { displayName: true } },
        course: { select: { title: true, slug: true, instructor: { select: { displayName: true } } } },
      },
    });
    if (!row) throw new NotFoundException();
    return {
      serial: row.serial,
      template: await this.bank.templateFor(row.courseId),
      learnerName: row.user.displayName,
      courseTitle: row.course.title,
      courseSlug: row.course.slug,
      instructorName: row.course.instructor?.displayName ?? null,
      issuedAt: row.issuedAt.toISOString(),
    };
  }

  private async publishedCourse(slug: string) {
    const course = await this.prisma.course.findFirst({ where: { slug, status: 'PUBLISHED' }, select: { id: true } });
    if (!course) throw new NotFoundException();
    return course;
  }
}
