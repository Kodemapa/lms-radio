import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { type AuthUser } from '../auth/auth-user';
import { LIVE_LESSON } from '../common/soft-delete';
import { PrismaService } from '../prisma/prisma.service';
import { CoursePermissions } from './course-permissions';

interface CourseRef {
  id: string;
  status: string;
  instructorId: string | null;
}

/** Single place that decides who may open a lesson or a media asset. */
@Injectable()
export class AccessService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly permissions: CoursePermissions,
  ) {}

  /**
   * Admins, the course's owner and its accepted co-instructors see everything,
   * including drafts. Other faculty are treated like any learner.
   */
  isManager(user: AuthUser, course: CourseRef): Promise<boolean> {
    return this.permissions.can(user, course, 'view');
  }

  async isEnrolled(userId: string, courseId: string): Promise<boolean> {
    const enrollment = await this.prisma.enrollment.findUnique({
      where: { userId_courseId: { userId, courseId } },
    });
    return !!enrollment;
  }

  /**
   * Free, published courses enrol the learner automatically the first time
   * they open the player, so it shows up in "My learning" straight away.
   * Paid courses still need checkout. Returns whether the user is enrolled.
   */
  async ensureEnrolled(
    user: AuthUser,
    course: { id: string; status: string; isFree: boolean; entranceTestEnabled: boolean },
    { bypassEntrance = false }: { bypassEntrance?: boolean } = {},
  ): Promise<boolean> {
    if (await this.isEnrolled(user.userId, course.id)) return true;
    if (course.status !== 'PUBLISHED' || !course.isFree) return false;
    // Courses with an entrance test only enrol learners who have passed it.
    if (course.entranceTestEnabled && !bypassEntrance && !(await this.passedEntrance(user.userId, course.id))) {
      return false;
    }
    await this.prisma.enrollment.upsert({
      where: { userId_courseId: { userId: user.userId, courseId: course.id } },
      create: { userId: user.userId, courseId: course.id },
      update: {},
    });
    return true;
  }

  async passedEntrance(userId: string, courseId: string): Promise<boolean> {
    return (await this.prisma.entranceAttempt.count({ where: { userId, courseId, passed: true } })) > 0;
  }

  /** Lesson ids in course order. */
  async orderedLessonIds(courseId: string): Promise<string[]> {
    const lessons = await this.prisma.lesson.findMany({
      where: { courseId, ...LIVE_LESSON },
      orderBy: [{ chapter: { position: 'asc' } }, { position: 'asc' }],
      select: { id: true },
    });
    return lessons.map((lesson) => lesson.id);
  }

  /** Sequential access: ids of lessons that are locked for this learner. */
  async lockedLessonIds(userId: string, courseId: string): Promise<Set<string>> {
    const [ordered, done, previews] = await Promise.all([
      this.orderedLessonIds(courseId),
      this.prisma.lessonProgress.findMany({
        where: { userId, courseId, completedAt: { not: null } },
        select: { lessonId: true },
      }),
      this.prisma.lesson.findMany({ where: { courseId, isPreview: true, ...LIVE_LESSON }, select: { id: true } }),
    ]);
    const completed = new Set(done.map((row) => row.lessonId));
    const preview = new Set(previews.map((row) => row.id));
    const locked = new Set<string>();
    let blocked = false;
    for (const id of ordered) {
      if (blocked && !preview.has(id)) locked.add(id);
      if (!completed.has(id)) blocked = true;
    }
    return locked;
  }

  /**
   * Returns the lesson if the user may open it, plus whether they are enrolled
   * (preview-only visitors aren't tracked).
   */
  async getAccessibleLesson(user: AuthUser, lessonId: string) {
    // Trashed lessons are gone for everyone until restored.
    const lesson = await this.prisma.lesson.findFirst({
      where: { id: lessonId, ...LIVE_LESSON },
      include: {
        course: {
          select: {
            id: true,
            slug: true,
            title: true,
            status: true,
            instructorId: true,
            sequentialAccess: true,
            isFree: true,
            entranceTestEnabled: true,
          },
        },
      },
    });
    if (!lesson) throw new NotFoundException();
    if (await this.isManager(user, lesson.course)) {
      // Staff testing a live free course get it in "My learning" too.
      await this.ensureEnrolled(user, lesson.course, { bypassEntrance: true });
      return { lesson, enrolled: false, manager: true };
    }
    if (lesson.course.status !== 'PUBLISHED') throw new NotFoundException();

    const enrolled = await this.ensureEnrolled(user, lesson.course);
    // With an entrance test, nothing opens (free previews included) until it is passed.
    if (!enrolled && lesson.course.entranceTestEnabled) {
      throw new ForbiddenException({ code: 'ENTRANCE_REQUIRED', courseSlug: lesson.course.slug });
    }
    if (!enrolled && !lesson.isPreview) {
      throw new ForbiddenException({ code: 'NOT_ENROLLED', courseSlug: lesson.course.slug });
    }
    if (enrolled && lesson.course.sequentialAccess) {
      const locked = await this.lockedLessonIds(user.userId, lesson.course.id);
      if (locked.has(lesson.id)) {
        throw new ForbiddenException({ code: 'LOCKED_SEQUENCE', courseSlug: lesson.course.slug });
      }
    }
    return { lesson, enrolled, manager: false };
  }

  /**
   * A user may open an asset if it is: the preview video of a published course,
   * a preview lesson, a lesson of a course they're enrolled in, theirs to
   * manage, an assignment file they submitted or must review, or their own upload.
   */
  async assertAssetAccess(user: AuthUser, assetId: string): Promise<void> {
    // Uploaders can always open their own files, e.g. a DICOM image faculty
    // are drawing on before the case is saved.
    const owned = await this.prisma.mediaAsset.count({ where: { id: assetId, ownerId: user.userId } });
    if (owned > 0) return;
    const courseSelect = { select: { id: true, status: true, instructorId: true } } as const;
    const lessonCourse = { select: { id: true, status: true, instructorId: true, entranceTestEnabled: true } } as const;
    const [lessons, previews, submissions, caseImages, imagingAttempts, workingFiles, references] = await Promise.all([
      this.prisma.lesson.findMany({
        where: { mediaAssetId: assetId, ...LIVE_LESSON },
        select: { isPreview: true, course: lessonCourse },
      }),
      this.prisma.course.findMany({
        where: { previewAssetId: assetId },
        select: { id: true, status: true, instructorId: true },
      }),
      this.prisma.assignmentSubmission.findMany({
        where: { fileAssetId: assetId },
        select: { userId: true, course: courseSelect },
      }),
      // DICOM images of imaging cases: same rules as lesson media.
      this.prisma.imagingImage.findMany({
        where: { assetId },
        select: { lesson: { select: { isPreview: true, course: lessonCourse } } },
      }),
      // A learner's submitted SR: theirs, or their course staff's to review.
      this.prisma.imagingAttempt.findMany({
        where: { srAssetId: assetId },
        select: { userId: true, lesson: { select: { course: courseSelect } } },
      }),
      // Photos / PDFs of a learner's working on a DICOM case: theirs, or their course staff's to check.
      this.prisma.imagingAttempt.findMany({
        where: { workingAssetIds: { has: assetId } },
        select: { userId: true, lesson: { select: { course: courseSelect } } },
      }),
      // Reference SRs are the answer key: course staff only.
      this.prisma.imagingCase.findMany({
        where: { referenceSrAssetId: assetId },
        select: { lesson: { select: { course: courseSelect } } },
      }),
    ]);
    if (
      lessons.length + previews.length + submissions.length + caseImages.length + imagingAttempts.length + workingFiles.length + references.length ===
      0
    ) {
      throw new NotFoundException();
    }

    for (const attempt of [...imagingAttempts, ...workingFiles]) {
      if (attempt.userId === user.userId || await this.isManager(user, attempt.lesson.course)) return;
    }
    for (const reference of references) {
      if (await this.isManager(user, reference.lesson.course)) return;
    }
    lessons.push(...caseImages.map((image) => image.lesson));

    for (const submission of submissions) {
      if (submission.userId === user.userId || await this.isManager(user, submission.course)) return;
    }
    for (const course of previews) {
      if (course.status === 'PUBLISHED' || await this.isManager(user, course)) return;
    }
    for (const { isPreview, course } of lessons) {
      if (await this.isManager(user, course)) return;
      if (course.status !== 'PUBLISHED') continue;
      if (await this.isEnrolled(user.userId, course.id)) return;
      // Free previews don't bypass an entrance test.
      if (isPreview && !course.entranceTestEnabled) return;
    }
    throw new ForbiddenException();
  }
}
