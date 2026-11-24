import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import {
  submissionProblems,
  TRASH_RETENTION_DAYS,
  type InstructorCourse,
  type InstructorCourseRow,
  type InstructorDashboard,
  type TrashItem,
  LESSON_DOCUMENT_TYPES,
} from '@obgyn/types';
import { type MediaKind, Prisma } from '@prisma/client';
import { randomBytes } from 'node:crypto';
import { AuditService } from '../audit/audit.service';
import { type AuthUser } from '../auth/auth-user';
import { CoursePermissions, type CourseNeed, type CourseRole } from '../courses/course-permissions';
import { LIVE_LESSON } from '../common/soft-delete';
import { PrismaService } from '../prisma/prisma.service';
import { CollaboratorsService } from '../teaching/collaborators.service';
import { countByDay } from '../teaching/insights.service';
import {
  type ChapterDto,
  type CourseDetailsDto,
  type CoursePricingDto,
  type LessonDto,
} from './dto';

const AUTHORING_INCLUDE = {
  chapters: {
    where: { deletedAt: null },
    orderBy: { position: 'asc' },
    include: {
      lessons: {
        where: { deletedAt: null },
        orderBy: { position: 'asc' },
        include: {
          mediaAsset: { select: { status: true, originalName: true, deidentified: true } },
          _count: { select: { questions: true } },
        },
      },
    },
  },
  reviewEvents: {
    orderBy: { createdAt: 'desc' },
    take: 50,
    include: { actor: { select: { displayName: true } } },
  },
} satisfies Prisma.CourseInclude;

type AuthoringCourse = Prisma.CourseGetPayload<{ include: typeof AUTHORING_INCLUDE }>;

const ROW_INCLUDE = {
  _count: { select: { enrollments: true, lessons: { where: LIVE_LESSON } } },
} satisfies Prisma.CourseInclude;

export function slugify(title: string): string {
  const base = title
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 60)
    .replace(/^-|-$/g, '');
  return `${base || 'course'}-${randomBytes(3).toString('hex')}`;
}

function toRow(course: Prisma.CourseGetPayload<{ include: typeof ROW_INCLUDE }>, myRole: CourseRole): InstructorCourseRow {
  return {
    id: course.id,
    myRole,
    slug: course.slug,
    title: course.title,
    status: course.status,
    changesRequested: course.status === 'DRAFT' && course.reviewNote !== null ? { note: course.reviewNote } : null,
    thumbnailAssetId: course.thumbnailAssetId,
    lessonCount: course._count.lessons,
    studentCount: course._count.enrollments,
    isFree: course.isFree,
    pricePaise: course.pricePaise,
    discountPricePaise: course.discountPricePaise,
    updatedAt: course.updatedAt.toISOString(),
  };
}

function toInstructorCourse(course: AuthoringCourse, myRole: CourseRole): InstructorCourse {
  return {
    id: course.id,
    myRole,
    slug: course.slug,
    status: course.status,
    reviewNote: course.reviewNote,
    reviewHistory: course.reviewEvents.map((event) => ({
      id: event.id,
      kind: event.kind,
      note: event.note,
      actorName: event.actor?.displayName ?? null,
      createdAt: event.createdAt.toISOString(),
    })),
    title: course.title,
    shortDescription: course.shortDescription,
    description: course.description,
    categoryId: course.categoryId,
    level: course.level,
    language: course.language,
    tags: course.tags,
    learnings: course.learnings,
    requirements: course.requirements,
    sequentialAccess: course.sequentialAccess,
    thumbnailAssetId: course.thumbnailAssetId,
    previewAssetId: course.previewAssetId,
    metaTitle: course.metaTitle,
    metaDescription: course.metaDescription,
    metaKeywords: course.metaKeywords,
    isFree: course.isFree,
    pricePaise: course.pricePaise,
    discountPricePaise: course.discountPricePaise,
    certificateEnabled: course.certificateEnabled,
    certificateFeePaise: course.certificateFeePaise,
    updatedAt: course.updatedAt.toISOString(),
    chapters: course.chapters.map((chapter) => ({
      id: chapter.id,
      position: chapter.position,
      title: chapter.title,
      description: chapter.description,
      lessons: chapter.lessons.map((lesson) => ({
        id: lesson.id,
        position: lesson.position,
        title: lesson.title,
        description: lesson.description,
        kind: lesson.kind,
        isPreview: lesson.isPreview,
        durationSec: lesson.durationSec,
        mediaAssetId: lesson.mediaAssetId,
        skippable: lesson.skippable,
        passPercent: lesson.passPercent,
        instructions: lesson.instructions,
        points: lesson.points,
        submissionKinds: lesson.submissionKinds.filter((k): k is 'IMAGE' | 'PDF' => k === 'IMAGE' || k === 'PDF'),
        questionCount: lesson._count.questions,
        media: lesson.mediaAsset
          ? {
              status: lesson.mediaAsset.status,
              originalName: lesson.mediaAsset.originalName,
              deidentified: lesson.mediaAsset.deidentified,
            }
          : null,
      })),
    })),
  };
}

const DAY_MS = 24 * 60 * 60 * 1000;

const cleanList = (items: string[]) =>
  [...new Set(items.map((item) => item.trim()).filter(Boolean))];

/**
 * Instructor course authoring. Instructors edit DRAFT and PUBLISHED courses
 * (published edits go live immediately and are audited); IN_REVIEW is locked
 * until the instructor withdraws it or an admin decides.
 */
@Injectable()
export class AuthoringService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly permissions: CoursePermissions,
    private readonly collaborators: CollaboratorsService,
  ) {}

  /** My role on each course in a list (owner, admin, or my co-instructor role). */
  private async rolesFor(user: AuthUser, courses: { id: string; instructorId: string | null }[]): Promise<Map<string, CourseRole>> {
    const shared = await this.prisma.courseCollaborator.findMany({
      where: { userId: user.userId, status: 'ACCEPTED', courseId: { in: courses.map((c) => c.id) } },
      select: { courseId: true, role: true },
    });
    const byCourse = new Map(shared.map((c) => [c.courseId, c.role as CourseRole]));
    return new Map(
      courses.map((c) => [c.id, c.instructorId === user.userId ? 'OWNER' : (byCourse.get(c.id) ?? (user.role === 'ADMIN' ? 'ADMIN' : 'GRADER'))]),
    );
  }

  /** Own courses plus those shared with me (admins: their own). */
  private async myCoursesWhere(user: AuthUser): Promise<Prisma.CourseWhereInput> {
    const ids = await this.permissions.courseIds(user, 'view');
    return ids === null ? { instructorId: user.userId } : { id: { in: ids } };
  }

  // ---- Dashboard & lists ------------------------------------------------------

  async dashboard(user: AuthUser): Promise<InstructorDashboard> {
    const where = await this.myCoursesWhere(user);
    const now = new Date();
    const since30 = new Date(now.getTime() - 30 * DAY_MS);
    const since7 = new Date(now.getTime() - 7 * DAY_MS);
    const gradeIds = await this.permissions.courseIds(user, 'grade');
    const [byStatus, totalStudents, totalLessons, recent, enrolments, active, completions30d, pendingSubmissions, invitations] = await Promise.all([
      this.prisma.course.groupBy({ by: ['status'], where, _count: { _all: true } }),
      this.prisma.enrollment.count({ where: { course: where } }),
      this.prisma.lesson.count({ where: { course: where, ...LIVE_LESSON } }),
      this.prisma.course.findMany({ where, include: ROW_INCLUDE, orderBy: { updatedAt: 'desc' }, take: 5 }),
      this.prisma.enrollment.findMany({ where: { course: where, createdAt: { gte: since30 } }, select: { createdAt: true } }),
      this.prisma.lessonProgress.groupBy({ by: ['userId'], where: { course: where, updatedAt: { gte: since7 } } }),
      this.prisma.lessonProgress.count({ where: { course: where, completedAt: { gte: since30 } } }),
      this.prisma.assignmentSubmission.count({ where: { status: 'SUBMITTED', ...(gradeIds === null ? {} : { courseId: { in: gradeIds } }) } }),
      this.collaborators.myInvitations(user),
    ]);
    const count = (status: string) => byStatus.find((row) => row.status === status)?._count._all ?? 0;
    const roles = await this.rolesFor(user, recent);
    return {
      totalCourses: byStatus.reduce((sum, row) => sum + row._count._all, 0),
      published: count('PUBLISHED'),
      inReview: count('IN_REVIEW'),
      drafts: count('DRAFT'),
      totalStudents,
      totalLessons,
      recentCourses: recent.map((c) => toRow(c, roles.get(c.id)!)),
      enrolmentsByDay: countByDay(enrolments.map((e) => e.createdAt), 30, now),
      activeLearners: active.length,
      completions30d,
      pendingSubmissions,
      invitations,
    };
  }

  async listCourses(user: AuthUser): Promise<InstructorCourseRow[]> {
    const courses = await this.prisma.course.findMany({
      where: await this.myCoursesWhere(user),
      include: ROW_INCLUDE,
      orderBy: { updatedAt: 'desc' },
    });
    const roles = await this.rolesFor(user, courses);
    return courses.map((c) => toRow(c, roles.get(c.id)!));
  }

  // ---- Course -----------------------------------------------------------------

  async createCourse(user: AuthUser, title: string): Promise<InstructorCourse> {
    const course = await this.prisma.course.create({
      data: { title: title.trim(), slug: slugify(title), instructorId: user.userId },
      include: AUTHORING_INCLUDE,
    });
    await this.log(user, 'course.created', course.id);
    return toInstructorCourse(course, 'OWNER');
  }

  async getCourse(user: AuthUser, courseId: string): Promise<InstructorCourse> {
    const course = await this.loadOwned(user, courseId, { need: 'view' });
    const role = await this.permissions.role(user, course);
    return toInstructorCourse(course, role!);
  }

  async updateDetails(user: AuthUser, courseId: string, dto: CourseDetailsDto): Promise<InstructorCourse> {
    const course = await this.loadOwned(user, courseId, { editable: true });
    if (dto.categoryId) {
      const exists = await this.prisma.category.count({ where: { id: dto.categoryId } });
      if (!exists) throw new BadRequestException('Unknown category');
    }
    if (dto.thumbnailAssetId) await this.assertAsset(user, dto.thumbnailAssetId, 'IMAGE', courseId);
    if (dto.previewAssetId) await this.assertAsset(user, dto.previewAssetId, 'VIDEO', courseId);

    await this.prisma.course.update({
      where: { id: course.id },
      data: {
        title: dto.title.trim(),
        shortDescription: dto.shortDescription.trim(),
        description: dto.description.trim(),
        categoryId: dto.categoryId,
        level: dto.level,
        language: dto.language,
        tags: cleanList(dto.tags).map((tag) => tag.toLowerCase()),
        learnings: cleanList(dto.learnings),
        requirements: cleanList(dto.requirements),
        sequentialAccess: dto.sequentialAccess,
        thumbnailAssetId: dto.thumbnailAssetId,
        previewAssetId: dto.previewAssetId,
        metaTitle: dto.metaTitle?.trim() || null,
        metaDescription: dto.metaDescription?.trim() || null,
        metaKeywords: dto.metaKeywords?.trim() || null,
      },
    });
    await this.log(user, 'course.details_updated', course.id, { status: course.status });
    return this.getCourse(user, course.id);
  }

  async updatePricing(user: AuthUser, courseId: string, dto: CoursePricingDto): Promise<InstructorCourse> {
    const course = await this.loadOwned(user, courseId, { editable: true, need: 'own' });
    if (!dto.isFree && dto.pricePaise < 100) {
      throw new BadRequestException('Paid courses cost at least ₹1');
    }
    if (dto.discountPricePaise !== null && dto.discountPricePaise >= dto.pricePaise) {
      throw new BadRequestException('Discount price must be lower than the price');
    }
    await this.prisma.course.update({
      where: { id: course.id },
      data: {
        isFree: dto.isFree,
        pricePaise: dto.isFree ? 0 : dto.pricePaise,
        discountPricePaise: dto.isFree ? null : dto.discountPricePaise,
        certificateEnabled: dto.certificateEnabled,
        // A certificate fee only makes sense on free courses.
        certificateFeePaise: dto.isFree && dto.certificateEnabled ? dto.certificateFeePaise : null,
      },
    });
    await this.log(user, 'course.pricing_updated', course.id);
    return this.getCourse(user, course.id);
  }

  async submit(user: AuthUser, courseId: string): Promise<InstructorCourse> {
    const course = await this.loadOwned(user, courseId, { need: 'own' });
    if (course.status !== 'DRAFT') throw new ConflictException({ code: 'NOT_A_DRAFT' });

    const questions = await this.prisma.quizQuestion.findMany({
      where: { lesson: { courseId: course.id } },
      select: { lessonId: true, text: true, explanation: true, options: { select: { text: true } } },
    });
    const quizText = (lessonId: string) =>
      questions
        .filter((q) => q.lessonId === lessonId)
        .flatMap((q) => [q.text, q.explanation ?? '', ...q.options.map((o) => o.text)]);
    const { problems, pcpndtMatches } = submissionProblems({
      ...course,
      chapters: course.chapters.map((chapter) => ({
        ...chapter,
        lessons: chapter.lessons.map((lesson) => ({
          ...lesson,
          media: lesson.mediaAsset,
          questionCount: lesson._count.questions,
          extraText: quizText(lesson.id),
        })),
      })),
    });
    if (problems.length > 0) {
      if (pcpndtMatches.length > 0) {
        await this.log(user, 'compliance.pcpndt_blocked', course.id, { matches: pcpndtMatches });
      }
      throw new UnprocessableEntityException({ code: 'NOT_READY', problems, pcpndtMatches });
    }

    await this.prisma.course.update({
      where: { id: course.id },
      data: { status: 'IN_REVIEW', submittedAt: new Date(), reviewNote: null },
    });
    await this.log(user, 'course.submitted', course.id);
    await this.prisma.courseReviewEvent.create({ data: { courseId: course.id, kind: 'SUBMITTED', actorId: user.userId } });
    return this.getCourse(user, course.id);
  }

  async withdraw(user: AuthUser, courseId: string): Promise<InstructorCourse> {
    const course = await this.loadOwned(user, courseId, { need: 'own' });
    if (course.status !== 'IN_REVIEW') throw new ConflictException({ code: 'NOT_IN_REVIEW' });
    await this.prisma.course.update({ where: { id: course.id }, data: { status: 'DRAFT' } });
    await this.log(user, 'course.withdrawn', course.id);
    await this.prisma.courseReviewEvent.create({ data: { courseId: course.id, kind: 'WITHDRAWN', actorId: user.userId } });
    return this.getCourse(user, course.id);
  }

  async deleteCourse(user: AuthUser, courseId: string): Promise<void> {
    const course = await this.loadOwned(user, courseId, { need: 'own' });
    if (course.status !== 'DRAFT') throw new ConflictException({ code: 'ONLY_DRAFTS' });
    const enrolled = await this.prisma.enrollment.count({ where: { courseId: course.id } });
    if (enrolled > 0) throw new ConflictException({ code: 'HAS_STUDENTS' });
    await this.prisma.course.delete({ where: { id: course.id } });
    await this.log(user, 'course.deleted', course.id, { title: course.title });
  }

  // ---- Chapters ---------------------------------------------------------------

  async addChapter(user: AuthUser, courseId: string, dto: ChapterDto): Promise<InstructorCourse> {
    const course = await this.loadOwned(user, courseId, { editable: true });
    const position = (course.chapters.at(-1)?.position ?? 0) + 1;
    await this.prisma.chapter.create({
      data: { courseId: course.id, position, title: dto.title.trim(), description: dto.description?.trim() || null },
    });
    return this.getCourse(user, course.id);
  }

  async updateChapter(user: AuthUser, chapterId: string, dto: ChapterDto): Promise<InstructorCourse> {
    const chapter = await this.ownedChapter(user, chapterId);
    await this.prisma.chapter.update({
      where: { id: chapter.id },
      data: { title: dto.title.trim(), description: dto.description?.trim() || null },
    });
    return this.getCourse(user, chapter.courseId);
  }

  async deleteChapter(user: AuthUser, chapterId: string): Promise<InstructorCourse> {
    const chapter = await this.ownedChapter(user, chapterId);
    // To the trash: the chapter and its live lessons share one timestamp, so restoring brings them back together.
    const deletedAt = new Date();
    await this.prisma.$transaction([
      this.prisma.lesson.updateMany({ where: { chapterId: chapter.id, deletedAt: null }, data: { deletedAt } }),
      this.prisma.chapter.update({ where: { id: chapter.id }, data: { deletedAt } }),
    ]);
    await this.renumber('chapter', chapter.courseId);
    await this.log(user, 'chapter.trashed', chapter.courseId);
    return this.getCourse(user, chapter.courseId);
  }

  async reorderChapters(user: AuthUser, courseId: string, ids: string[]): Promise<InstructorCourse> {
    const course = await this.loadOwned(user, courseId, { editable: true });
    this.assertSameSet(course.chapters.map((c) => c.id), ids);
    await this.prisma.$transaction(
      ids.map((id, index) => this.prisma.chapter.update({ where: { id }, data: { position: index + 1 } })),
    );
    return this.getCourse(user, course.id);
  }

  // ---- Lessons ----------------------------------------------------------------

  async addLesson(user: AuthUser, chapterId: string, dto: LessonDto): Promise<InstructorCourse> {
    const chapter = await this.ownedChapter(user, chapterId);
    const durationSec = await this.lessonMedia(user, dto, chapter.courseId);
    const last = await this.prisma.lesson.findFirst({
      where: { chapterId: chapter.id, deletedAt: null },
      orderBy: { position: 'desc' },
      select: { position: true },
    });
    await this.prisma.lesson.create({
      data: {
        courseId: chapter.courseId,
        chapterId: chapter.id,
        position: (last?.position ?? 0) + 1,
        ...this.lessonData(dto, durationSec),
      },
    });
    await this.log(user, 'lesson.created', chapter.courseId);
    return this.getCourse(user, chapter.courseId);
  }

  async updateLesson(user: AuthUser, lessonId: string, dto: LessonDto): Promise<InstructorCourse> {
    const lesson = await this.ownedLesson(user, lessonId);
    const durationSec = await this.lessonMedia(user, dto, lesson.courseId);
    // Questions belong to the lesson's type: in-video questions have a time, quiz
    // questions don't. A video's questions become the quiz's questions when it turns
    // into a quiz; any other type change with questions would hide them from learners.
    const kindChanged = dto.kind !== lesson.kind;
    const questionCount = kindChanged ? await this.prisma.quizQuestion.count({ where: { lessonId } }) : 0;
    const videoToQuiz = lesson.kind === 'VIDEO' && dto.kind === 'QUIZ';
    if (questionCount > 0 && !videoToQuiz) {
      throw new ConflictException({
        code: 'LESSON_HAS_QUESTIONS',
        message: "This lesson has questions. Delete them first, or keep the lesson's type.",
      });
    }
    await this.prisma.$transaction([
      this.prisma.lesson.update({ where: { id: lesson.id }, data: this.lessonData(dto, durationSec) }),
      ...(questionCount > 0 && videoToQuiz
        ? [this.prisma.quizQuestion.updateMany({ where: { lessonId }, data: { atSec: null } })]
        : []),
    ]);
    await this.log(user, 'lesson.updated', lesson.courseId);
    return this.getCourse(user, lesson.courseId);
  }

  async deleteLesson(user: AuthUser, lessonId: string): Promise<InstructorCourse> {
    const lesson = await this.ownedLesson(user, lessonId);
    // To the trash; learner progress and attempts are kept in case it is restored.
    await this.prisma.lesson.update({ where: { id: lesson.id }, data: { deletedAt: new Date() } });
    await this.renumber('lesson', lesson.chapterId);
    await this.log(user, 'lesson.trashed', lesson.courseId);
    return this.getCourse(user, lesson.courseId);
  }

  async reorderLessons(user: AuthUser, chapterId: string, ids: string[]): Promise<InstructorCourse> {
    const chapter = await this.ownedChapter(user, chapterId);
    const lessons = await this.prisma.lesson.findMany({ where: { chapterId: chapter.id, deletedAt: null }, select: { id: true } });
    this.assertSameSet(lessons.map((l) => l.id), ids);
    await this.prisma.$transaction(
      ids.map((id, index) => this.prisma.lesson.update({ where: { id }, data: { position: index + 1 } })),
    );
    return this.getCourse(user, chapter.courseId);
  }

  // ---- Trash ------------------------------------------------------------------

  /** Trashed chapters and lessons (older than the retention period are purged first). */
  async trash(user: AuthUser, courseId: string): Promise<TrashItem[]> {
    await this.loadOwned(user, courseId);
    await this.purgeExpired(courseId);
    const [chapters, lessons] = await Promise.all([
      this.prisma.chapter.findMany({
        where: { courseId, deletedAt: { not: null } },
        include: { _count: { select: { lessons: true } } },
        orderBy: { deletedAt: 'desc' },
      }),
      this.prisma.lesson.findMany({
        where: { courseId, deletedAt: { not: null } },
        include: { chapter: { select: { title: true, deletedAt: true } } },
        orderBy: { deletedAt: 'desc' },
      }),
    ]);
    const purgeAt = (date: Date) => new Date(date.getTime() + TRASH_RETENTION_DAYS * DAY_MS).toISOString();
    return [
      ...chapters.map((c) => ({
        kind: 'CHAPTER' as const,
        id: c.id,
        title: c.title,
        chapterTitle: null,
        lessonCount: c._count.lessons,
        deletedAt: c.deletedAt!.toISOString(),
        purgeAt: purgeAt(c.deletedAt!),
      })),
      // Lessons trashed together with their chapter are listed under the chapter only.
      ...lessons
        .filter((l) => !(l.chapter.deletedAt && l.chapter.deletedAt.getTime() === l.deletedAt!.getTime()))
        .map((l) => ({
          kind: 'LESSON' as const,
          id: l.id,
          title: l.title,
          chapterTitle: l.chapter.title,
          lessonCount: 0,
          deletedAt: l.deletedAt!.toISOString(),
          purgeAt: purgeAt(l.deletedAt!),
        })),
    ].sort((a, b) => b.deletedAt.localeCompare(a.deletedAt));
  }

  /** Puts a chapter (with the lessons trashed with it) or a lesson back at the end. */
  async restore(user: AuthUser, kind: 'chapter' | 'lesson', id: string): Promise<InstructorCourse> {
    if (kind === 'chapter') {
      const chapter = await this.prisma.chapter.findUnique({ where: { id } });
      if (!chapter?.deletedAt) throw new NotFoundException();
      await this.loadOwned(user, chapter.courseId, { editable: true });
      const last = await this.prisma.chapter.findFirst({ where: { courseId: chapter.courseId, deletedAt: null }, orderBy: { position: 'desc' } });
      await this.prisma.$transaction([
        this.prisma.lesson.updateMany({ where: { chapterId: id, deletedAt: chapter.deletedAt }, data: { deletedAt: null } }),
        this.prisma.chapter.update({ where: { id }, data: { deletedAt: null, position: (last?.position ?? 0) + 1 } }),
      ]);
      await this.renumber('lesson', id);
      await this.log(user, 'chapter.restored', chapter.courseId);
      return this.getCourse(user, chapter.courseId);
    }
    const lesson = await this.prisma.lesson.findUnique({ where: { id }, include: { chapter: { select: { deletedAt: true } } } });
    if (!lesson?.deletedAt) throw new NotFoundException();
    await this.loadOwned(user, lesson.courseId, { editable: true });
    if (lesson.chapter.deletedAt) throw new ConflictException({ code: 'CHAPTER_IN_TRASH', message: 'Restore its chapter first' });
    const last = await this.prisma.lesson.findFirst({ where: { chapterId: lesson.chapterId, deletedAt: null }, orderBy: { position: 'desc' } });
    await this.prisma.lesson.update({ where: { id }, data: { deletedAt: null, position: (last?.position ?? 0) + 1 } });
    await this.log(user, 'lesson.restored', lesson.courseId);
    return this.getCourse(user, lesson.courseId);
  }

  /** Deletes a trashed item for good, with its learners' progress and attempts. */
  async purge(user: AuthUser, kind: 'chapter' | 'lesson', id: string): Promise<void> {
    const row =
      kind === 'chapter'
        ? await this.prisma.chapter.findUnique({ where: { id }, select: { courseId: true, deletedAt: true } })
        : await this.prisma.lesson.findUnique({ where: { id }, select: { courseId: true, deletedAt: true } });
    if (!row?.deletedAt) throw new NotFoundException();
    await this.loadOwned(user, row.courseId, { editable: true });
    if (kind === 'chapter') await this.prisma.chapter.delete({ where: { id } });
    else await this.prisma.lesson.delete({ where: { id } });
    await this.log(user, `${kind}.purged`, row.courseId);
  }

  private async purgeExpired(courseId: string): Promise<void> {
    const cutoff = new Date(Date.now() - TRASH_RETENTION_DAYS * DAY_MS);
    await this.prisma.lesson.deleteMany({ where: { courseId, deletedAt: { lt: cutoff } } });
    await this.prisma.chapter.deleteMany({ where: { courseId, deletedAt: { lt: cutoff } } });
  }

  // ---- Helpers ----------------------------------------------------------------

  /** Loads a course the user may act on: `need` defaults to edit (see CoursePermissions). */
  private async loadOwned(
    user: AuthUser,
    courseId: string,
    { editable = false, need = 'edit' }: { editable?: boolean; need?: CourseNeed } = {},
  ): Promise<AuthoringCourse> {
    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
      include: AUTHORING_INCLUDE,
    });
    if (!course) throw new NotFoundException();
    if (!(await this.permissions.can(user, course, need))) throw new ForbiddenException();
    if (editable && (course.status === 'IN_REVIEW' || course.status === 'RETIRED')) {
      throw new ConflictException({ code: 'LOCKED', status: course.status });
    }
    return course;
  }

  private async ownedChapter(user: AuthUser, chapterId: string) {
    const chapter = await this.prisma.chapter.findUnique({ where: { id: chapterId } });
    if (!chapter || chapter.deletedAt) throw new NotFoundException();
    await this.loadOwned(user, chapter.courseId, { editable: true });
    return chapter;
  }

  private async ownedLesson(user: AuthUser, lessonId: string) {
    const lesson = await this.prisma.lesson.findUnique({ where: { id: lessonId }, include: { chapter: { select: { deletedAt: true } } } });
    if (!lesson || lesson.deletedAt || lesson.chapter.deletedAt) throw new NotFoundException();
    await this.loadOwned(user, lesson.courseId, { editable: true });
    return lesson;
  }

  /** Only fields that apply to the lesson's kind are kept. */
  private lessonData(dto: LessonDto, durationSec: number | null) {
    const usesMedia = dto.kind === 'VIDEO' || dto.kind === 'PDF';
    const gated = dto.kind === 'QUIZ' || dto.kind === 'ASSIGNMENT' || dto.kind === 'IMAGING';
    return {
      title: dto.title.trim(),
      description: dto.description?.trim() || null,
      kind: dto.kind,
      isPreview: dto.isPreview,
      mediaAssetId: usesMedia ? dto.mediaAssetId : null,
      durationSec: usesMedia ? durationSec : null,
      skippable: gated ? dto.skippable : false,
      passPercent: dto.kind === 'QUIZ' || dto.kind === 'IMAGING' ? (dto.passPercent ?? null) : null,
      instructions: dto.kind === 'ASSIGNMENT' ? dto.instructions?.trim() || null : null,
      points: dto.kind === 'ASSIGNMENT' ? dto.points : null,
      submissionKinds: dto.kind === 'ASSIGNMENT' ? [...new Set(dto.submissionKinds)] : [],
    };
  }

  /** Checks the lesson's file and returns its duration. */
  private async lessonMedia(user: AuthUser, dto: LessonDto, courseId: string): Promise<number | null> {
    if (!dto.mediaAssetId || (dto.kind !== 'VIDEO' && dto.kind !== 'PDF')) return null;
    const asset = await this.assertAsset(user, dto.mediaAssetId, dto.kind, courseId);
    // Learners read lesson documents in the protected PDF viewer, which can't show slides.
    if (dto.kind === 'PDF' && !(LESSON_DOCUMENT_TYPES as readonly string[]).includes(asset.mimeType)) {
      throw new BadRequestException('Lesson documents must be PDF. Save PowerPoint slides as PDF first.');
    }
    return asset.durationSec;
  }

  /** The uploader's own file, or one already used by this course (so co-instructors can re-save lessons). */
  private async assertAsset(user: AuthUser, assetId: string, kind: MediaKind, courseId?: string) {
    const asset = await this.prisma.mediaAsset.findUnique({ where: { id: assetId } });
    const inCourse =
      !!courseId &&
      (await this.prisma.course.count({
        where: { id: courseId, OR: [{ thumbnailAssetId: assetId }, { previewAssetId: assetId }, { lessons: { some: { mediaAssetId: assetId } } }] },
      })) > 0;
    if (!asset || (asset.ownerId !== user.userId && user.role !== 'ADMIN' && !inCourse)) {
      throw new BadRequestException('Unknown file');
    }
    if (asset.kind !== kind) throw new BadRequestException(`Expected a ${kind.toLowerCase()} file`);
    if (asset.status !== 'READY') throw new BadRequestException('File upload has not finished');
    return asset;
  }

  private assertSameSet(current: string[], proposed: string[]): void {
    const a = [...current].sort().join();
    const b = [...proposed].sort().join();
    if (a !== b) throw new BadRequestException('Reorder must include every item exactly once');
  }

  /** Closes gaps in positions after a delete. */
  private async renumber(kind: 'chapter' | 'lesson', parentId: string): Promise<void> {
    if (kind === 'chapter') {
      const rows = await this.prisma.chapter.findMany({
        where: { courseId: parentId, deletedAt: null },
        orderBy: { position: 'asc' },
        select: { id: true },
      });
      await this.prisma.$transaction(
        rows.map(({ id }, index) =>
          this.prisma.chapter.update({ where: { id }, data: { position: index + 1 } }),
        ),
      );
      return;
    }
    const rows = await this.prisma.lesson.findMany({
      where: { chapterId: parentId, deletedAt: null },
      orderBy: { position: 'asc' },
      select: { id: true },
    });
    await this.prisma.$transaction(
      rows.map(({ id }, index) =>
        this.prisma.lesson.update({ where: { id }, data: { position: index + 1 } }),
      ),
    );
  }

  private log(user: AuthUser, action: string, courseId: string, metadata?: Prisma.InputJsonValue) {
    return this.audit.log({ actorId: user.userId, action, resource: 'course', resourceId: courseId, metadata });
  }
}
