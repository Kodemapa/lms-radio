import { ForbiddenException, HttpException, HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import { type CourseDetail, type CourseListResponse } from '@obgyn/types';
import { Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { type AuthUser } from '../auth/auth-user';
import { PrismaService } from '../prisma/prisma.service';
import { AccessService } from './access.service';
import {
  COURSE_DETAIL_INCLUDE,
  COURSE_SUMMARY_INCLUDE,
  toCourseDetail,
  toCourseSummary,
} from './course-mapper';
import { type CourseListQueryDto } from './dto';

const ORDER_BY: Record<string, Prisma.CourseOrderByWithRelationInput[]> = {
  newest: [{ publishedAt: 'desc' }],
  popular: [{ enrollments: { _count: 'desc' } }, { publishedAt: 'desc' }],
  price_asc: [{ isFree: 'desc' }, { pricePaise: 'asc' }],
  price_desc: [{ isFree: 'asc' }, { pricePaise: 'desc' }],
  title: [{ title: 'asc' }],
};

@Injectable()
export class CoursesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
    private readonly audit: AuditService,
  ) {}

  async listPublished(query: CourseListQueryDto): Promise<CourseListResponse> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 12;
    const where: Prisma.CourseWhereInput = { status: 'PUBLISHED' };

    if (query.category) {
      where.category = { OR: [{ slug: query.category }, { parent: { slug: query.category } }] };
    }
    if (query.level) where.level = query.level;
    if (query.language) where.language = query.language;
    if (query.instructor) where.instructorId = query.instructor;
    if (query.price) where.isFree = query.price === 'free';
    if (query.q?.trim()) {
      const q = query.q.trim();
      where.OR = [
        { title: { contains: q, mode: 'insensitive' } },
        { shortDescription: { contains: q, mode: 'insensitive' } },
        { tags: { has: q.toLowerCase() } },
      ];
    }

    const [total, courses] = await this.prisma.$transaction([
      this.prisma.course.count({ where }),
      this.prisma.course.findMany({
        where,
        include: COURSE_SUMMARY_INCLUDE,
        orderBy: ORDER_BY[query.sort ?? 'newest'],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    return { items: courses.map(toCourseSummary), total, page, pageSize };
  }

  async getPublished(slug: string): Promise<CourseDetail> {
    const course = await this.prisma.course.findFirst({
      where: { slug, status: 'PUBLISHED' },
      include: COURSE_DETAIL_INCLUDE,
    });
    if (!course) throw new NotFoundException();
    return toCourseDetail(course);
  }

  async enrollmentStatus(user: AuthUser, slug: string): Promise<{ enrolled: boolean }> {
    const course = await this.prisma.course.findUnique({ where: { slug }, select: { id: true } });
    if (!course) throw new NotFoundException();
    return { enrolled: await this.access.isEnrolled(user.userId, course.id) };
  }

  async enroll(user: AuthUser, slug: string): Promise<void> {
    const course = await this.prisma.course.findFirst({ where: { slug, status: 'PUBLISHED' } });
    if (!course) throw new NotFoundException();
    const staff = user.role !== 'LEARNER';
    if (course.entranceTestEnabled && !staff && !(await this.access.passedEntrance(user.userId, course.id))) {
      throw new ForbiddenException({ code: 'ENTRANCE_REQUIRED' });
    }
    if (!course.isFree) {
      // Paid enrolment happens through checkout (Phase 3: cart & payments).
      throw new HttpException({ code: 'PAYMENT_REQUIRED' }, HttpStatus.PAYMENT_REQUIRED);
    }
    await this.prisma.enrollment.upsert({
      where: { userId_courseId: { userId: user.userId, courseId: course.id } },
      update: {},
      create: { userId: user.userId, courseId: course.id },
    });
    await this.audit.log({
      actorId: user.userId,
      action: 'course.enrolled',
      resource: 'course',
      resourceId: course.id,
    });
  }
}
