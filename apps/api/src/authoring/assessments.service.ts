import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  QuestionInputSchema,
  type InstructorQuestion,
  type InstructorSubmission,
  type SubmissionStatus,
} from '@obgyn/types';
import { AuditService } from '../audit/audit.service';
import { type AuthUser } from '../auth/auth-user';
import { CoursePermissions } from '../courses/course-permissions';
import { MailService } from '../mail/mail.service';
import { assignmentReviewedEmail } from '../mail/templates';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { type QuestionDto, type SubmissionReviewDto } from './dto';

/** Quiz questions and assignment review for a course's instructor (or admins). */
@Injectable()
export class AssessmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly permissions: CoursePermissions,
    private readonly mail: MailService,
    private readonly notifications: NotificationsService,
  ) {}

  // ---- Quiz questions ------------------------------------------------------------

  async questions(user: AuthUser, lessonId: string): Promise<InstructorQuestion[]> {
    const lesson = await this.ownedQuizLesson(user, lessonId);
    const rows = await this.prisma.quizQuestion.findMany({
      where: { lessonId },
      orderBy: lesson.kind === 'VIDEO' ? [{ atSec: 'asc' }, { position: 'asc' }] : { position: 'asc' },
      include: { options: { orderBy: { position: 'asc' } } },
    });
    return rows.map((row) => ({
      id: row.id,
      position: row.position,
      atSec: row.atSec,
      bankQuestionId: row.bankQuestionId,
      topicId: row.topicId,
      text: row.text,
      explanation: row.explanation,
      allowMultiple: row.allowMultiple,
      options: row.options.map((o) => ({ id: o.id, text: o.text, isCorrect: o.isCorrect })),
    }));
  }

  async addQuestion(user: AuthUser, lessonId: string, dto: QuestionDto): Promise<InstructorQuestion[]> {
    const lesson = await this.ownedQuizLesson(user, lessonId, { editable: true });
    const input = this.validate(dto, lesson.kind);
    await this.assertTopic(lesson.courseId, input.topicId);
    const last = await this.prisma.quizQuestion.findFirst({
      where: { lessonId },
      orderBy: { position: 'desc' },
      select: { position: true },
    });
    await this.prisma.quizQuestion.create({
      data: {
        lessonId,
        position: (last?.position ?? 0) + 1,
        atSec: input.atSec ?? null,
        topicId: input.topicId ?? null,
        text: input.text,
        explanation: input.explanation,
        allowMultiple: input.allowMultiple,
        options: { create: input.options.map((o, i) => ({ ...o, position: i + 1 })) },
      },
    });
    return this.questions(user, lessonId);
  }

  async updateQuestion(user: AuthUser, questionId: string, dto: QuestionDto): Promise<InstructorQuestion[]> {
    const question = await this.ownedQuestion(user, questionId);
    const lesson = await this.prisma.lesson.findUniqueOrThrow({ where: { id: question.lessonId } });
    const input = this.validate(dto, lesson.kind);
    await this.assertTopic(lesson.courseId, input.topicId);
    await this.prisma.$transaction([
      this.prisma.quizOption.deleteMany({ where: { questionId } }),
      this.prisma.quizQuestion.update({
        where: { id: questionId },
        data: {
          atSec: input.atSec ?? null,
          ...(input.topicId !== undefined ? { topicId: input.topicId } : {}),
          text: input.text,
          explanation: input.explanation,
          allowMultiple: input.allowMultiple,
          options: { create: input.options.map((o, i) => ({ ...o, position: i + 1 })) },
        },
      }),
    ]);
    return this.questions(user, question.lessonId);
  }

  async deleteQuestion(user: AuthUser, questionId: string): Promise<InstructorQuestion[]> {
    const question = await this.ownedQuestion(user, questionId);
    await this.prisma.quizQuestion.delete({ where: { id: questionId } });
    const rest = await this.prisma.quizQuestion.findMany({
      where: { lessonId: question.lessonId },
      orderBy: { position: 'asc' },
      select: { id: true },
    });
    await this.prisma.$transaction(
      rest.map(({ id }, i) => this.prisma.quizQuestion.update({ where: { id }, data: { position: i + 1 } })),
    );
    return this.questions(user, question.lessonId);
  }

  // ---- Assignment submissions ------------------------------------------------------

  async submissions(user: AuthUser, status: SubmissionStatus): Promise<InstructorSubmission[]> {
    // Courses I own or grade for (admins: all).
    const courseIds = await this.permissions.courseIds(user, 'grade');
    const rows = await this.prisma.assignmentSubmission.findMany({
      where: {
        status,
        ...(courseIds === null ? {} : { courseId: { in: courseIds } }),
      },
      orderBy: { updatedAt: 'asc' },
      include: {
        user: { select: { id: true, displayName: true } },
        lesson: { select: { id: true, title: true, points: true } },
        course: { select: { id: true, title: true } },
        file: { select: { originalName: true } },
      },
      take: 200,
    });
    return rows.map((row) => ({
      id: row.id,
      status: row.status,
      text: row.text,
      fileAssetId: row.fileAssetId,
      fileName: row.file?.originalName ?? null,
      feedback: row.feedback,
      updatedAt: row.updatedAt.toISOString(),
      learner: row.user,
      lesson: row.lesson,
      course: row.course,
    }));
  }

  async review(user: AuthUser, submissionId: string, dto: SubmissionReviewDto): Promise<void> {
    const submission = await this.prisma.assignmentSubmission.findUnique({
      where: { id: submissionId },
      include: {
        course: { select: { id: true, instructorId: true, slug: true, title: true } },
        lesson: { select: { title: true } },
        user: { select: { email: true, displayName: true } },
      },
    });
    if (!submission) throw new NotFoundException();
    if (!(await this.permissions.can(user, submission.course, 'grade'))) throw new ForbiddenException();
    if (submission.status !== 'SUBMITTED') throw new ConflictException({ code: 'ALREADY_REVIEWED' });

    await this.prisma.$transaction([
      this.prisma.assignmentSubmission.update({
        where: { id: submissionId },
        data: {
          status: dto.approve ? 'APPROVED' : 'REJECTED',
          feedback: dto.feedback?.trim() || null,
          reviewedById: user.userId,
          reviewedAt: new Date(),
        },
      }),
      // A rejected assignment has to be redone before the course counts as complete.
      ...(dto.approve
        ? []
        : [
            this.prisma.lessonProgress.updateMany({
              where: { userId: submission.userId, lessonId: submission.lessonId },
              data: { completedAt: null, skipped: false },
            }),
          ]),
    ]);
    await this.audit.log({
      actorId: user.userId,
      action: dto.approve ? 'assignment.approved' : 'assignment.rejected',
      resource: 'assignment_submission',
      resourceId: submissionId,
    });
    await this.notifications.notify({
      userId: submission.userId,
      kind: 'ASSIGNMENT_REVIEWED',
      data: {
        lessonTitle: submission.lesson.title,
        courseTitle: submission.course.title,
        outcome: dto.approve ? 'APPROVED' : 'RETURNED',
        // Shown in full when the learner opens the notification.
        ...(dto.feedback?.trim() ? { feedback: dto.feedback.trim() } : {}),
      },
      link: `/learn/${submission.course.slug}/${submission.lessonId}`,
    });
    if (submission.user.email) {
      this.mail.sendInBackground([
        assignmentReviewedEmail(
          submission.user.email,
          submission.user.displayName,
          submission.lesson.title,
          dto.approve,
          `/en/learn/${submission.course.slug}/${submission.lessonId}`,
        ),
      ]);
    }
  }

  // ---- Helpers ------------------------------------------------------------------

  /** Video questions need a time; quiz questions never have one. */
  private async assertTopic(courseId: string, topicId: string | null | undefined) {
    if (topicId && !(await this.prisma.questionTopic.count({ where: { id: topicId, courseId } }))) {
      throw new BadRequestException('Unknown topic');
    }
  }

  private validate(dto: QuestionDto, kind: string) {
    const parsed = QuestionInputSchema.safeParse(dto);
    if (!parsed.success) throw new BadRequestException(parsed.error.issues.map((i) => i.message));
    if (kind === 'VIDEO' && (parsed.data.atSec === null || parsed.data.atSec === undefined)) {
      throw new BadRequestException('Set when the question appears in the video');
    }
    return { ...parsed.data, atSec: kind === 'VIDEO' ? parsed.data.atSec : null };
  }

  private async ownedQuizLesson(user: AuthUser, lessonId: string, { editable = false } = {}) {
    const lesson = await this.prisma.lesson.findUnique({
      where: { id: lessonId },
      include: { course: { select: { id: true, instructorId: true, status: true } } },
    });
    if (!lesson || lesson.deletedAt || (lesson.kind !== 'QUIZ' && lesson.kind !== 'VIDEO')) throw new NotFoundException();
    if (!(await this.permissions.can(user, lesson.course, 'edit'))) throw new ForbiddenException();
    if (editable && lesson.course.status === 'IN_REVIEW') throw new ConflictException({ code: 'LOCKED' });
    return lesson;
  }

  private async ownedQuestion(user: AuthUser, questionId: string) {
    const question = await this.prisma.quizQuestion.findUnique({ where: { id: questionId } });
    if (!question) throw new NotFoundException();
    await this.ownedQuizLesson(user, question.lessonId, { editable: true });
    return question;
  }
}
