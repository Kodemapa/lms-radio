import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { type InstructorApplication, type ReviewQueueItem } from '@obgyn/types';
import { AuditService } from '../audit/audit.service';
import { type AuthUser } from '../auth/auth-user';
import { APPLICATION_INCLUDE, toApplication } from '../applications/applications.service';
import { COURSE_SUMMARY_INCLUDE, toCourseSummary } from '../courses/course-mapper';
import { MailService } from '../mail/mail.service';
import { applicationDecisionEmail, courseDecisionEmail } from '../mail/templates';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly mail: MailService,
  ) {}

  async reviewQueue(): Promise<ReviewQueueItem[]> {
    const courses = await this.prisma.course.findMany({
      where: { status: 'IN_REVIEW' },
      include: COURSE_SUMMARY_INCLUDE,
      orderBy: { submittedAt: 'asc' },
    });
    return courses.map((course) => ({
      ...toCourseSummary(course),
      submittedAt: course.submittedAt?.toISOString() ?? null,
    }));
  }

  async publish(admin: AuthUser, courseId: string): Promise<void> {
    const course = await this.inReview(courseId);
    await this.prisma.course.update({
      where: { id: course.id },
      data: { status: 'PUBLISHED', publishedAt: course.publishedAt ?? new Date(), reviewNote: null },
    });
    await this.log(admin, 'course.published', 'course', course.id);
    await this.notifyInstructor(course, true);
  }

  async reject(admin: AuthUser, courseId: string, note: string | null): Promise<void> {
    const course = await this.inReview(courseId);
    await this.prisma.course.update({
      where: { id: course.id },
      data: { status: 'DRAFT', reviewNote: note?.trim() || null },
    });
    await this.log(admin, 'course.rejected', 'course', course.id, note);
    await this.notifyInstructor(course, false);
  }

  async applications(status: 'PENDING' | 'APPROVED' | 'REJECTED'): Promise<InstructorApplication[]> {
    const rows = await this.prisma.instructorApplication.findMany({
      where: { status },
      include: APPLICATION_INCLUDE,
      orderBy: { createdAt: 'asc' },
    });
    return rows.map(toApplication);
  }

  async decideApplication(admin: AuthUser, id: string, approve: boolean, note: string | null): Promise<void> {
    const application = await this.prisma.instructorApplication.findUnique({
      where: { id },
      include: { user: { select: { role: true, email: true, displayName: true } } },
    });
    if (!application) throw new NotFoundException();
    if (application.status !== 'PENDING') throw new ConflictException({ code: 'ALREADY_DECIDED' });

    await this.prisma.$transaction([
      this.prisma.instructorApplication.update({
        where: { id },
        data: {
          status: approve ? 'APPROVED' : 'REJECTED',
          reviewNote: note?.trim() || null,
          reviewedById: admin.userId,
          reviewedAt: new Date(),
        },
      }),
      ...(approve
        ? [
            this.prisma.user.update({
              where: { id: application.userId },
              data: {
                role: application.user.role === 'ADMIN' ? 'ADMIN' : 'FACULTY',
                headline: application.headline,
                bio: application.bio,
              },
            }),
          ]
        : []),
    ]);
    await this.log(
      admin,
      approve ? 'instructor_application.approved' : 'instructor_application.rejected',
      'instructor_application',
      id,
      note,
    );
    if (application.user.email) {
      this.mail.sendInBackground([applicationDecisionEmail(application.user.email, application.user.displayName, approve)]);
    }
  }

  private async notifyInstructor(course: { id: string; title: string; instructorId: string | null }, published: boolean) {
    if (!course.instructorId) return;
    const owner = await this.prisma.user.findUnique({ where: { id: course.instructorId }, select: { email: true, displayName: true } });
    if (owner?.email) {
      this.mail.sendInBackground([courseDecisionEmail(owner.email, owner.displayName, course.title, course.id, published)]);
    }
  }

  private async inReview(courseId: string) {
    const course = await this.prisma.course.findUnique({ where: { id: courseId } });
    if (!course) throw new NotFoundException();
    if (course.status !== 'IN_REVIEW') throw new ConflictException({ code: 'NOT_IN_REVIEW' });
    return course;
  }

  private log(admin: AuthUser, action: string, resource: string, resourceId: string, note?: string | null) {
    return this.audit.log({
      actorId: admin.userId,
      action,
      resource,
      resourceId,
      metadata: note ? { note } : undefined,
    });
  }
}
