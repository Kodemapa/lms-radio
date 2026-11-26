import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  progressPercent,
  readResources,
  unlockedUntilSec,
  watchedDelta,
  type CheckpointResult,
  type MyCourse,
  type MySubmission,
  type PlayerLessonDetail,
  type PlayerOutline,
  type QuizResult,
} from '@obgyn/types';
import { Prisma } from '@prisma/client';
import { randomInt } from 'node:crypto';
import { AuditService } from '../audit/audit.service';
import { type AuthUser } from '../auth/auth-user';
import { AccessService } from '../courses/access.service';
import { COURSE_SUMMARY_INCLUDE, toCourseSummary } from '../courses/course-mapper';
import { ExamsService } from '../exams/exams.service';
import { ImagingService } from '../imaging/imaging.service';
import { LIVE_LESSON } from '../common/soft-delete';
import { PrismaService } from '../prisma/prisma.service';
import { type AssignmentSubmitDto, type ProgressDto } from './dto';
import { certificateSerial, DEFAULT_PASS_PERCENT, gradeQuiz } from './grading';

/** Lesson kinds a learner can mark complete themselves. */
const SELF_COMPLETE = new Set(['VIDEO', 'PDF', 'SIMULATOR', 'LIVE_CLASS']);

type AttemptRow = { id: string; answers: Prisma.JsonValue; scorePercent: number; passed: boolean; createdAt: Date };

@Injectable()
export class LearningService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
    private readonly audit: AuditService,
    private readonly imaging: ImagingService,
    private readonly exams: ExamsService,
  ) {}

  // ---- Outline ----------------------------------------------------------------

  async outline(user: AuthUser, slug: string): Promise<PlayerOutline> {
    const course = await this.prisma.course.findUnique({
      where: { slug },
      include: {
        chapters: {
          where: { deletedAt: null },
          orderBy: { position: 'asc' },
          include: { lessons: { where: { deletedAt: null }, orderBy: { position: 'asc' } } },
        },
      },
    });
    if (!course) throw new NotFoundException();
    const manager = await this.access.isManager(user, course);
    if (!manager && course.status !== 'PUBLISHED') throw new NotFoundException();
    // Opening a free course enrols automatically (staff included, for My learning).
    const enrolledNow = await this.access.ensureEnrolled(user, course, { bypassEntrance: manager });
    const enrolled = !manager && enrolledNow;
    const allLessons = course.chapters.flatMap((c) => c.lessons);
    // The player is also where learners take the entrance test, so it opens for them too.
    if (!manager && !enrolled && !course.entranceTestEnabled && !allLessons.some((l) => l.isPreview)) {
      throw new ForbiddenException({ code: 'NOT_ENROLLED', courseSlug: slug });
    }

    const [progress, locked, certificate, wishlisted, entrancePassed] = await Promise.all([
      this.prisma.lessonProgress.findMany({ where: { userId: user.userId, courseId: course.id } }),
      // Visitors see free previews only (none at all while an entrance test is pending);
      // enrolled learners may be held back by sequential access.
      !manager && !enrolled
        ? Promise.resolve(
            new Set(allLessons.filter((l) => course.entranceTestEnabled || !l.isPreview).map((l) => l.id)),
          )
        : course.sequentialAccess && !manager
          ? this.access.lockedLessonIds(user.userId, course.id)
          : Promise.resolve(new Set<string>()),
      this.prisma.certificate.findUnique({ where: { userId_courseId: { userId: user.userId, courseId: course.id } } }),
      this.prisma.wishlistItem.count({ where: { userId: user.userId, courseId: course.id } }),
      course.entranceTestEnabled ? this.access.passedEntrance(user.userId, course.id) : Promise.resolve(false),
    ]);
    const entranceOpen = course.entranceTestEnabled && !manager && !enrolled && !entrancePassed;
    const byLesson = new Map(progress.map((p) => [p.lessonId, p]));
    const lessons = course.chapters.flatMap((c) => c.lessons);
    const completed = lessons.filter((l) => byLesson.get(l.id)?.completedAt).length;

    // Resume at the most recently touched unfinished lesson, else the first unfinished one.
    const unfinished = lessons.filter((l) => !byLesson.get(l.id)?.completedAt && !locked.has(l.id));
    const recent = [...progress]
      .filter((p) => !p.completedAt)
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())[0];
    // Until the entrance test is passed there is nothing to resume: the test comes first.
    const resumeLessonId = entranceOpen ? null : (recent?.lessonId ?? unfinished[0]?.id ?? lessons[0]?.id ?? null);

    return {
      course: {
        id: course.id,
        slug: course.slug,
        title: course.title,
        sequentialAccess: course.sequentialAccess,
        certificateEnabled: course.certificateEnabled,
        certificateFeePaise: course.certificateFeePaise,
      },
      progress: { completed, total: lessons.length, percent: progressPercent(completed, lessons.length) },
      chapters: course.chapters.map((chapter) => ({
        id: chapter.id,
        position: chapter.position,
        title: chapter.title,
        lessons: chapter.lessons.map((lesson) => ({
          id: lesson.id,
          position: lesson.position,
          title: lesson.title,
          kind: lesson.kind,
          durationSec: lesson.durationSec,
          completed: !!byLesson.get(lesson.id)?.completedAt,
          skipped: byLesson.get(lesson.id)?.skipped ?? false,
          locked: locked.has(lesson.id),
        })),
      })),
      enrolled: enrolled || manager,
      wishlisted: wishlisted > 0,
      entrance: course.entranceTestEnabled
        ? {
            passed: entrancePassed || manager || enrolled,
            questionCount: course.entranceQuestionCount,
            passPercent: course.entrancePassPercent,
          }
        : null,
      resumeLessonId,
      certificateSerial: certificate?.serial ?? null,
    };
  }

  // ---- Lesson -----------------------------------------------------------------

  async lesson(user: AuthUser, lessonId: string): Promise<PlayerLessonDetail> {
    const { lesson, enrolled, manager } = await this.access.getAccessibleLesson(user, lessonId);
    const [ordered, progress, media, questions, attempt, submission] = await Promise.all([
      this.access.orderedLessonIds(lesson.courseId),
      this.prisma.lessonProgress.findUnique({ where: { userId_lessonId: { userId: user.userId, lessonId } } }),
      lesson.mediaAssetId
        ? this.prisma.mediaAsset.findFirst({ where: { id: lesson.mediaAssetId, status: 'READY' } })
        : null,
      lesson.kind === 'QUIZ' || lesson.kind === 'VIDEO'
        ? this.prisma.quizQuestion.findMany({
            where: { lessonId, atSec: lesson.kind === 'VIDEO' ? { not: null } : null },
            orderBy: lesson.kind === 'VIDEO' ? { atSec: 'asc' } : { position: 'asc' },
            include: { options: { orderBy: { position: 'asc' } } },
          })
        : [],
      lesson.kind === 'QUIZ'
        ? this.prisma.quizAttempt.findFirst({ where: { userId: user.userId, lessonId }, orderBy: { createdAt: 'desc' } })
        : null,
      lesson.kind === 'ASSIGNMENT'
        ? this.prisma.assignmentSubmission.findUnique({
            where: { userId_lessonId: { userId: user.userId, lessonId } },
            include: { file: { select: { originalName: true } } },
          })
        : null,
    ]);
    const index = ordered.indexOf(lesson.id);
    const passPercent = lesson.passPercent ?? DEFAULT_PASS_PERCENT;
    const isExam = ExamsService.isExam(lesson);
    // Exam questions stay hidden until the learner's sitting starts (and after it ends).
    const [exam, showQuestions] = isExam
      ? await Promise.all([this.exams.playerExam(user, lesson), this.exams.questionsVisible(user, lesson, manager)])
      : [null, true];
    const checkpoints = lesson.kind === 'VIDEO' ? await this.checkpointsFor(user, lessonId, questions) : [];

    return {
      id: lesson.id,
      title: lesson.title,
      description: lesson.description,
      resources: readResources(lesson.resources),
      kind: lesson.kind,
      durationSec: lesson.durationSec,
      isPreview: lesson.isPreview,
      skippable: lesson.skippable,
      course: { id: lesson.course.id, slug: lesson.course.slug, title: lesson.course.title },
      media: media ? { assetId: media.id, mimeType: media.mimeType } : null,
      progress: {
        positionSec: progress?.positionSec ?? 0,
        completed: !!progress?.completedAt,
        skipped: progress?.skipped ?? false,
      },
      prevLessonId: index > 0 ? ordered[index - 1]! : null,
      nextLessonId: index >= 0 && index < ordered.length - 1 ? ordered[index + 1]! : null,
      // Staff previewing their course are tracked too, so they can test the full flow.
      enrolled: enrolled || manager,
      checkpoints,
      unlockedUntilSec: unlockedUntilSec(checkpoints),
      quiz:
        lesson.kind === 'QUIZ'
          ? {
              passPercent,
              // Correct answers are never sent before an attempt.
              questions: (showQuestions ? questions : []).map((q) => ({
                id: q.id,
                text: q.text,
                allowMultiple: q.allowMultiple,
                options: q.options.map((o) => ({ id: o.id, text: o.text })),
              })),
              lastResult: attempt ? this.examSafe(this.toResult(attempt, questions, passPercent), isExam) : null,
            }
          : null,
      assignment:
        lesson.kind === 'ASSIGNMENT'
          ? {
              instructions: lesson.instructions ?? '',
              points: lesson.points,
              submissionKinds: lesson.submissionKinds.filter((k): k is 'IMAGE' | 'PDF' => k === 'IMAGE' || k === 'PDF'),
              submission: submission ? this.toSubmission(submission) : null,
            }
          : null,
      imaging: lesson.kind === 'IMAGING' ? await this.imaging.publicCase(user, lesson) : null,
      exam,
    };
  }

  async updateProgress(user: AuthUser, lessonId: string, dto: ProgressDto): Promise<void> {
    const { lesson, enrolled, manager } = await this.access.getAccessibleLesson(user, lessonId);
    if (!enrolled && !manager) return; // free-preview visitors aren't tracked
    if (dto.completed !== undefined && !SELF_COMPLETE.has(lesson.kind)) {
      throw new BadRequestException('Quizzes and assignments are completed by passing or submitting them');
    }
    let positionSec = dto.positionSec;
    if (lesson.kind === 'VIDEO') {
      const checkpoints = await this.checkpointsFor(user, lessonId);
      const lockedAt = unlockedUntilSec(checkpoints);
      if (lockedAt !== null) {
        // In-video questions gate the rest of the video and its completion.
        if (dto.completed) throw new ConflictException({ code: 'CHECKPOINTS_PENDING', unlockedUntilSec: lockedAt });
        if (positionSec !== undefined) positionSec = Math.min(positionSec, lockedAt);
      }
    }
    const completedAt = dto.completed === undefined ? undefined : dto.completed ? new Date() : null;
    // Watch time: forward playback since the last report, capped by real time elapsed.
    const previous =
      lesson.kind === 'VIDEO' && positionSec !== undefined
        ? await this.prisma.lessonProgress.findUnique({
            where: { userId_lessonId: { userId: user.userId, lessonId } },
            select: { positionSec: true, furthestSec: true, updatedAt: true },
          })
        : null;
    const watched = previous && positionSec !== undefined ? watchedDelta(previous.positionSec, positionSec, Date.now() - previous.updatedAt.getTime()) : 0;
    await this.prisma.lessonProgress.upsert({
      where: { userId_lessonId: { userId: user.userId, lessonId } },
      create: {
        userId: user.userId,
        lessonId,
        courseId: lesson.courseId,
        positionSec: positionSec ?? 0,
        furthestSec: positionSec ?? 0,
        views: dto.opened ? 1 : 0,
        completedAt: completedAt ?? null,
      },
      update: {
        ...(positionSec !== undefined ? { positionSec } : {}),
        ...(positionSec !== undefined && positionSec > (previous?.furthestSec ?? 0) ? { furthestSec: positionSec } : {}),
        ...(watched > 0 ? { watchedSec: { increment: watched } } : {}),
        ...(dto.opened ? { views: { increment: 1 } } : {}),
        // Never un-complete by accident: only an explicit `completed: false` does.
        ...(completedAt !== undefined ? { completedAt, skipped: false } : {}),
      },
    });
  }

  async skip(user: AuthUser, lessonId: string): Promise<void> {
    const { lesson, enrolled, manager } = await this.access.getAccessibleLesson(user, lessonId);
    if (!enrolled && !manager) throw new ForbiddenException({ code: 'NOT_ENROLLED' });
    if (!lesson.skippable) throw new BadRequestException('This lesson cannot be skipped');
    await this.markComplete(user.userId, lesson.id, lesson.courseId, true);
  }

  // ---- In-video questions -------------------------------------------------------

  /** Answer an in-video question. Only an exactly-correct answer unlocks the next part. */
  async answerCheckpoint(
    user: AuthUser,
    lessonId: string,
    questionId: string,
    optionIds: string[],
  ): Promise<CheckpointResult> {
    const { lesson } = await this.access.getAccessibleLesson(user, lessonId);
    if (lesson.kind !== 'VIDEO') throw new BadRequestException('Not a video lesson');
    const question = await this.prisma.quizQuestion.findFirst({
      where: { id: questionId, lessonId, atSec: { not: null } },
      include: { options: true },
    });
    if (!question) throw new NotFoundException();

    const { questions } = gradeQuiz([question], { [question.id]: optionIds }, 100);
    const correct = questions[0]!.correct;
    const saved = await this.prisma.checkpointAnswer.upsert({
      where: { userId_questionId: { userId: user.userId, questionId } },
      create: { userId: user.userId, questionId, lessonId, attempts: 1, passedAt: correct ? new Date() : null },
      update: { attempts: { increment: 1 }, ...(correct ? { passedAt: new Date() } : {}) },
    });
    const checkpoints = await this.checkpointsFor(user, lessonId);
    return {
      correct,
      // The explanation (and so the answer) is only revealed once they get it right.
      explanation: correct ? question.explanation : null,
      attempts: saved.attempts,
      unlockedUntilSec: unlockedUntilSec(checkpoints),
    };
  }

  private async checkpointsFor(
    user: AuthUser,
    lessonId: string,
    preloaded?: { id: string; atSec: number | null; text: string; allowMultiple: boolean; options: { id: string; text: string }[] }[],
  ) {
    const questions =
      preloaded ??
      (await this.prisma.quizQuestion.findMany({
        where: { lessonId, atSec: { not: null } },
        orderBy: { atSec: 'asc' },
        include: { options: { orderBy: { position: 'asc' } } },
      }));
    const passed = new Set(
      (
        await this.prisma.checkpointAnswer.findMany({
          where: { userId: user.userId, lessonId, passedAt: { not: null } },
          select: { questionId: true },
        })
      ).map((a) => a.questionId),
    );
    return questions
      .filter((q) => q.atSec !== null)
      .map((q) => ({
        id: q.id,
        atSec: q.atSec!,
        text: q.text,
        allowMultiple: q.allowMultiple,
        options: q.options.map((o) => ({ id: o.id, text: o.text })),
        // Everyone, including staff previewing the course, must answer to continue.
        passed: passed.has(q.id),
      }));
  }

  // ---- Quiz -------------------------------------------------------------------

  async submitQuiz(user: AuthUser, lessonId: string, answers: Record<string, string[]>): Promise<QuizResult> {
    const { lesson, enrolled, manager } = await this.access.getAccessibleLesson(user, lessonId);
    if (lesson.kind !== 'QUIZ') throw new BadRequestException('Not a quiz');
    if (!enrolled && !manager) throw new ForbiddenException({ code: 'NOT_ENROLLED' });
    const isExam = ExamsService.isExam(lesson);
    // Exams: one sitting, within its time (staff previewing are held to the same rules).
    const examSession = isExam ? await this.exams.assertCanSubmit(user, lesson) : null;
    const questions = await this.prisma.quizQuestion.findMany({
      where: { lessonId, atSec: null },
      orderBy: { position: 'asc' },
      include: { options: true },
    });
    if (questions.length === 0) throw new ConflictException({ code: 'QUIZ_EMPTY' });

    const clean = Object.fromEntries(
      Object.entries(answers ?? {}).map(([id, value]) => [id, Array.isArray(value) ? value.map(String) : []]),
    );
    const passPercent = lesson.passPercent ?? DEFAULT_PASS_PERCENT;
    const graded = gradeQuiz(questions, clean, passPercent);
    const attempt = await this.prisma.quizAttempt.create({
      data: {
        userId: user.userId,
        lessonId,
        answers: Object.fromEntries(graded.questions.map((q) => [q.questionId, q.selectedOptionIds])),
        scorePercent: graded.scorePercent,
        passed: graded.passed,
      },
    });
    if (examSession) await this.exams.markSubmitted(examSession, attempt.id);
    if (graded.passed) await this.markComplete(user.userId, lesson.id, lesson.courseId, false);
    return this.examSafe({ attemptId: attempt.id, passPercent, createdAt: attempt.createdAt.toISOString(), ...graded }, isExam);
  }

  /**
   * Exam results show the score only: the correct answers and explanations would help
   * learners still sitting it. Practice quizzes show the full review.
   */
  private examSafe(result: QuizResult, isExam: boolean): QuizResult {
    return isExam ? { ...result, questions: [] } : result;
  }

  // ---- Assignment ---------------------------------------------------------------

  async submitAssignment(user: AuthUser, lessonId: string, dto: AssignmentSubmitDto): Promise<MySubmission> {
    const { lesson, enrolled, manager } = await this.access.getAccessibleLesson(user, lessonId);
    if (lesson.kind !== 'ASSIGNMENT') throw new BadRequestException('Not an assignment');
    if (!enrolled && !manager) throw new ForbiddenException({ code: 'NOT_ENROLLED' });
    const text = dto.text?.trim() || null;
    if (!text && !dto.fileAssetId) throw new BadRequestException('Write an answer or attach a file');

    if (dto.fileAssetId) {
      const file = await this.prisma.mediaAsset.findUnique({ where: { id: dto.fileAssetId } });
      if (!file || file.ownerId !== user.userId || file.status !== 'READY') {
        throw new BadRequestException('Unknown file');
      }
      if (!lesson.submissionKinds.includes(file.kind)) {
        throw new BadRequestException('This file type is not accepted for this assignment');
      }
    }

    const existing = await this.prisma.assignmentSubmission.findUnique({
      where: { userId_lessonId: { userId: user.userId, lessonId } },
    });
    if (existing?.status === 'APPROVED') throw new ConflictException({ code: 'ALREADY_APPROVED' });

    const data = { text, fileAssetId: dto.fileAssetId, status: 'SUBMITTED' as const, feedback: null, reviewedAt: null, reviewedById: null };
    const saved = await this.prisma.assignmentSubmission.upsert({
      where: { userId_lessonId: { userId: user.userId, lessonId } },
      create: { ...data, userId: user.userId, lessonId, courseId: lesson.courseId },
      update: data,
      include: { file: { select: { originalName: true } } },
    });
    await this.markComplete(user.userId, lesson.id, lesson.courseId, false);
    await this.audit.log({
      actorId: user.userId,
      action: 'assignment.submitted',
      resource: 'assignment_submission',
      resourceId: saved.id,
    });
    return this.toSubmission(saved);
  }

  // ---- Certificates & my learning ----------------------------------------------

  async claimCertificate(user: AuthUser, slug: string): Promise<{ serial: string }> {
    const course = await this.prisma.course.findFirst({ where: { slug, status: 'PUBLISHED' } });
    if (!course) throw new NotFoundException();
    if (!(await this.access.isEnrolled(user.userId, course.id))) throw new ForbiddenException({ code: 'NOT_ENROLLED' });
    if (!course.certificateEnabled) throw new BadRequestException({ code: 'NO_CERTIFICATE' });

    const existing = await this.prisma.certificate.findUnique({
      where: { userId_courseId: { userId: user.userId, courseId: course.id } },
    });
    if (existing) return { serial: existing.serial };

    const [total, done] = await Promise.all([
      this.prisma.lesson.count({ where: { courseId: course.id, ...LIVE_LESSON } }),
      this.prisma.lessonProgress.count({ where: { userId: user.userId, courseId: course.id, completedAt: { not: null }, lesson: LIVE_LESSON } }),
    ]);
    if (total === 0 || done < total) throw new ConflictException({ code: 'COURSE_INCOMPLETE', done, total });
    if (course.isFree && (course.certificateFeePaise ?? 0) > 0) {
      // Paying the certificate fee arrives with checkout (Phase 3).
      throw new HttpException({ code: 'CERTIFICATE_FEE' }, HttpStatus.PAYMENT_REQUIRED);
    }

    for (let tries = 0; tries < 5; tries++) {
      try {
        const certificate = await this.prisma.certificate.create({
          data: { serial: certificateSerial(randomInt), userId: user.userId, courseId: course.id },
        });
        await this.audit.log({
          actorId: user.userId,
          action: 'certificate.issued',
          resource: 'certificate',
          resourceId: certificate.id,
        });
        return { serial: certificate.serial };
      } catch (error) {
        if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')) throw error;
      }
    }
    throw new ConflictException('Could not allocate a certificate number');
  }

  async myCourses(user: AuthUser): Promise<MyCourse[]> {
    const enrollments = await this.prisma.enrollment.findMany({
      where: { userId: user.userId },
      orderBy: { createdAt: 'desc' },
      include: { course: { include: COURSE_SUMMARY_INCLUDE } },
    });
    const courseIds = enrollments.map((e) => e.courseId);
    const [progress, certificates, lessonOrder] = await Promise.all([
      this.prisma.lessonProgress.findMany({ where: { userId: user.userId, courseId: { in: courseIds } } }),
      this.prisma.certificate.findMany({ where: { userId: user.userId, courseId: { in: courseIds } } }),
      this.prisma.lesson.findMany({
        where: { courseId: { in: courseIds }, ...LIVE_LESSON },
        orderBy: [{ chapter: { position: 'asc' } }, { position: 'asc' }],
        select: { id: true, courseId: true },
      }),
    ]);
    return enrollments.map(({ course, createdAt }) => {
      const mine = progress.filter((p) => p.courseId === course.id);
      const ordered = lessonOrder.filter((l) => l.courseId === course.id);
      // Only live lessons count (trashed ones keep their progress rows).
      const live = new Set(ordered.map((l) => l.id));
      const done = new Set(mine.filter((p) => p.completedAt && live.has(p.lessonId)).map((p) => p.lessonId));
      const recent = mine.filter((p) => !p.completedAt).sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())[0];
      return {
        course: toCourseSummary(course),
        progress: {
          completed: done.size,
          total: ordered.length,
          percent: progressPercent(done.size, ordered.length),
        },
        resumeLessonId: recent?.lessonId ?? ordered.find((l) => !done.has(l.id))?.id ?? ordered[0]?.id ?? null,
        enrolledAt: createdAt.toISOString(),
        certificateSerial: certificates.find((c) => c.courseId === course.id)?.serial ?? null,
      };
    });
  }

  // ---- Helpers ----------------------------------------------------------------

  private async markComplete(userId: string, lessonId: string, courseId: string, skipped: boolean) {
    await this.prisma.lessonProgress.upsert({
      where: { userId_lessonId: { userId, lessonId } },
      create: { userId, lessonId, courseId, completedAt: new Date(), skipped },
      update: { completedAt: new Date(), skipped },
    });
  }

  private toResult(
    attempt: AttemptRow,
    questions: { id: string; explanation: string | null; options: { id: string; isCorrect: boolean }[] }[],
    passPercent: number,
  ): QuizResult {
    const answers = (attempt.answers ?? {}) as Record<string, string[]>;
    const graded = gradeQuiz(questions, answers, passPercent);
    return {
      attemptId: attempt.id,
      // The stored score is authoritative even if questions changed since.
      scorePercent: attempt.scorePercent,
      passed: attempt.passed,
      passPercent,
      createdAt: attempt.createdAt.toISOString(),
      questions: graded.questions,
    };
  }

  private toSubmission(row: {
    id: string;
    text: string | null;
    fileAssetId: string | null;
    status: 'SUBMITTED' | 'APPROVED' | 'REJECTED';
    feedback: string | null;
    updatedAt: Date;
    file: { originalName: string | null } | null;
  }): MySubmission {
    return {
      id: row.id,
      text: row.text,
      fileAssetId: row.fileAssetId,
      fileName: row.file?.originalName ?? null,
      status: row.status,
      feedback: row.feedback,
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
