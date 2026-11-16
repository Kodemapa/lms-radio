import { z } from 'zod';
import { CertificateTemplateSchema } from './assessment.js';
import { CourseSummarySchema, LessonKindSchema } from './course.js';
import { ImagingCasePublicSchema } from './imaging.js';

// ---- Player -----------------------------------------------------------------

export const ProgressSummarySchema = z.object({
  completed: z.number().int(),
  total: z.number().int(),
  percent: z.number().int().min(0).max(100),
});
export type ProgressSummary = z.infer<typeof ProgressSummarySchema>;

export const PlayerLessonSchema = z.object({
  id: z.string().uuid(),
  position: z.number().int(),
  title: z.string(),
  kind: LessonKindSchema,
  durationSec: z.number().int().nullable(),
  completed: z.boolean(),
  skipped: z.boolean(),
  /** Sequential access: an earlier lesson isn't finished yet. */
  locked: z.boolean(),
});
export type PlayerLesson = z.infer<typeof PlayerLessonSchema>;

export const PlayerOutlineSchema = z.object({
  course: z.object({
    id: z.string().uuid(),
    slug: z.string(),
    title: z.string(),
    sequentialAccess: z.boolean(),
    certificateEnabled: z.boolean(),
    certificateFeePaise: z.number().int().nullable(),
  }),
  progress: ProgressSummarySchema,
  chapters: z.array(
    z.object({
      id: z.string().uuid(),
      position: z.number().int(),
      title: z.string(),
      lessons: z.array(PlayerLessonSchema),
    }),
  ),
  /** False for visitors who only see free previews. */
  enrolled: z.boolean(),
  wishlisted: z.boolean(),
  /** The entrance test, shown as the first item of the course. */
  entrance: z
    .object({
      passed: z.boolean(),
      questionCount: z.number().int(),
      passPercent: z.number().int(),
    })
    .nullable(),
  /** Where "Continue learning" should go. */
  resumeLessonId: z.string().uuid().nullable(),
  certificateSerial: z.string().nullable(),
});
export type PlayerOutline = z.infer<typeof PlayerOutlineSchema>;

export const QuizQuestionPublicSchema = z.object({
  id: z.string().uuid(),
  text: z.string(),
  allowMultiple: z.boolean(),
  options: z.array(z.object({ id: z.string().uuid(), text: z.string() })),
});
export type QuizQuestionPublic = z.infer<typeof QuizQuestionPublicSchema>;

export const QuizResultSchema = z.object({
  attemptId: z.string().uuid(),
  scorePercent: z.number().int(),
  passed: z.boolean(),
  passPercent: z.number().int(),
  createdAt: z.string().datetime(),
  questions: z.array(
    z.object({
      questionId: z.string().uuid(),
      correct: z.boolean(),
      selectedOptionIds: z.array(z.string().uuid()),
      correctOptionIds: z.array(z.string().uuid()),
      explanation: z.string().nullable(),
    }),
  ),
});
export type QuizResult = z.infer<typeof QuizResultSchema>;

export const QuizSubmitSchema = z.object({
  answers: z.record(z.string().uuid(), z.array(z.string().uuid()).max(20)),
});
export type QuizSubmit = z.infer<typeof QuizSubmitSchema>;

export const SUBMISSION_STATUSES = ['SUBMITTED', 'APPROVED', 'REJECTED'] as const;
export const SubmissionStatusSchema = z.enum(SUBMISSION_STATUSES);
export type SubmissionStatus = z.infer<typeof SubmissionStatusSchema>;

export const MySubmissionSchema = z.object({
  id: z.string().uuid(),
  text: z.string().nullable(),
  fileAssetId: z.string().uuid().nullable(),
  fileName: z.string().nullable(),
  status: SubmissionStatusSchema,
  feedback: z.string().nullable(),
  updatedAt: z.string().datetime(),
});
export type MySubmission = z.infer<typeof MySubmissionSchema>;

export const AssignmentSubmitSchema = z
  .object({
    text: z.string().trim().max(10_000).nullable(),
    fileAssetId: z.string().uuid().nullable(),
  })
  .refine((value) => !!value.text || !!value.fileAssetId, {
    message: 'Write an answer or attach a file',
    path: ['text'],
  });
export type AssignmentSubmit = z.infer<typeof AssignmentSubmitSchema>;

export const VideoCheckpointSchema = QuizQuestionPublicSchema.extend({
  /** Playback pauses here until the question is answered correctly. */
  atSec: z.number().int().nonnegative(),
  passed: z.boolean(),
});
export type VideoCheckpoint = z.infer<typeof VideoCheckpointSchema>;

export const CheckpointAnswerSchema = z.object({ optionIds: z.array(z.string().uuid()).min(1).max(20) });
export type CheckpointAnswer = z.infer<typeof CheckpointAnswerSchema>;

export const CheckpointResultSchema = z.object({
  correct: z.boolean(),
  /** Shown once answered correctly. */
  explanation: z.string().nullable(),
  attempts: z.number().int(),
  /** New lock point after this answer (null = whole video unlocked). */
  unlockedUntilSec: z.number().int().nullable(),
});
export type CheckpointResult = z.infer<typeof CheckpointResultSchema>;

/**
 * The furthest second a learner may watch: the first unanswered checkpoint.
 * null means no lock (every checkpoint passed, or there are none).
 */
export function unlockedUntilSec(checkpoints: { atSec: number; passed: boolean }[]): number | null {
  const pending = checkpoints.filter((c) => !c.passed).map((c) => c.atSec);
  return pending.length ? Math.min(...pending) : null;
}

export const PlayerLessonDetailSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  description: z.string().nullable(),
  kind: LessonKindSchema,
  durationSec: z.number().int().nullable(),
  isPreview: z.boolean(),
  skippable: z.boolean(),
  course: z.object({ id: z.string().uuid(), slug: z.string(), title: z.string() }),
  media: z.object({ assetId: z.string().uuid(), mimeType: z.string() }).nullable(),
  progress: z.object({ positionSec: z.number().int(), completed: z.boolean(), skipped: z.boolean() }),
  prevLessonId: z.string().uuid().nullable(),
  nextLessonId: z.string().uuid().nullable(),
  /** False for preview-only visitors: progress isn't tracked. */
  enrolled: z.boolean(),
  /** VIDEO: in-video questions, in time order. */
  checkpoints: z.array(VideoCheckpointSchema),
  /** VIDEO: playback can't go past this second until the next checkpoint is passed. */
  unlockedUntilSec: z.number().int().nullable(),
  quiz: z
    .object({
      passPercent: z.number().int(),
      questions: z.array(QuizQuestionPublicSchema),
      lastResult: QuizResultSchema.nullable(),
    })
    .nullable(),
  assignment: z
    .object({
      instructions: z.string(),
      points: z.number().int().nullable(),
      submissionKinds: z.array(z.enum(['IMAGE', 'PDF'])),
      submission: MySubmissionSchema.nullable(),
    })
    .nullable(),
  /** IMAGING: a DICOM case to measure and report on. */
  imaging: ImagingCasePublicSchema.nullable(),
});
export type PlayerLessonDetail = z.infer<typeof PlayerLessonDetailSchema>;

export const ProgressUpdateSchema = z.object({
  positionSec: z.number().int().min(0).optional(),
  completed: z.boolean().optional(),
});
export type ProgressUpdate = z.infer<typeof ProgressUpdateSchema>;

// ---- My learning, wishlist, certificates, reviews ---------------------------

export const MyCourseSchema = z.object({
  course: CourseSummarySchema,
  progress: ProgressSummarySchema,
  resumeLessonId: z.string().uuid().nullable(),
  enrolledAt: z.string().datetime(),
  certificateSerial: z.string().nullable(),
});
export type MyCourse = z.infer<typeof MyCourseSchema>;

export const CertificatePublicSchema = z.object({
  serial: z.string(),
  template: CertificateTemplateSchema.extend({ logoAssetId: z.string().uuid().nullable() }),
  learnerName: z.string(),
  courseTitle: z.string(),
  courseSlug: z.string(),
  instructorName: z.string().nullable(),
  issuedAt: z.string().datetime(),
});
export type CertificatePublic = z.infer<typeof CertificatePublicSchema>;

export const ReviewSchema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().nullable(),
  authorName: z.string(),
  updatedAt: z.string().datetime(),
  mine: z.boolean(),
  /** The course team's public reply. */
  reply: z.string().nullable().default(null),
});
export type Review = z.infer<typeof ReviewSchema>;

export const ReviewListSchema = z.object({
  average: z.number().nullable(),
  count: z.number().int(),
  /** Count per star, index 0 = 1 star. */
  distribution: z.array(z.number().int()).length(5),
  items: z.array(ReviewSchema),
});
export type ReviewList = z.infer<typeof ReviewListSchema>;

export const ReviewInputSchema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().trim().max(2000).nullable(),
});
export type ReviewInput = z.infer<typeof ReviewInputSchema>;

// ---- Instructor: quiz & assignment authoring --------------------------------

export const QuestionInputSchema = z
  .object({
    /** In-video questions only: when it appears (seconds). */
    atSec: z.number().int().min(0).max(24 * 3600).nullable().optional(),
    text: z.string().trim().min(1).max(1000),
    explanation: z.string().trim().max(2000).nullable(),
    allowMultiple: z.boolean(),
    options: z
      .array(z.object({ text: z.string().trim().min(1).max(500), isCorrect: z.boolean() }))
      .min(2, 'Add at least two options')
      .max(8),
  })
  .superRefine((value, ctx) => {
    const correct = value.options.filter((option) => option.isCorrect).length;
    if (correct === 0) ctx.addIssue({ code: 'custom', path: ['options'], message: 'Mark the correct answer' });
    if (!value.allowMultiple && correct > 1) {
      ctx.addIssue({ code: 'custom', path: ['options'], message: 'Only one answer can be correct' });
    }
  });
export type QuestionInput = z.infer<typeof QuestionInputSchema>;

export const InstructorQuestionSchema = z.object({
  id: z.string().uuid(),
  position: z.number().int(),
  atSec: z.number().int().nullable(),
  bankQuestionId: z.string().uuid().nullable(),
  text: z.string(),
  explanation: z.string().nullable(),
  allowMultiple: z.boolean(),
  options: z.array(z.object({ id: z.string().uuid(), text: z.string(), isCorrect: z.boolean() })),
});
export type InstructorQuestion = z.infer<typeof InstructorQuestionSchema>;

export const InstructorSubmissionSchema = z.object({
  id: z.string().uuid(),
  status: SubmissionStatusSchema,
  text: z.string().nullable(),
  fileAssetId: z.string().uuid().nullable(),
  fileName: z.string().nullable(),
  feedback: z.string().nullable(),
  updatedAt: z.string().datetime(),
  learner: z.object({ id: z.string().uuid(), displayName: z.string() }),
  lesson: z.object({ id: z.string().uuid(), title: z.string(), points: z.number().int().nullable() }),
  course: z.object({ id: z.string().uuid(), title: z.string() }),
});
export type InstructorSubmission = z.infer<typeof InstructorSubmissionSchema>;

export const SubmissionReviewSchema = z.object({
  approve: z.boolean(),
  feedback: z.string().trim().max(2000).nullable(),
});
export type SubmissionReview = z.infer<typeof SubmissionReviewSchema>;

/**
 * Progress percent. Rounded down so 99.6% never shows as 100%, but any
 * progress shows at least 1% so the bar visibly moves on long courses.
 */
export function progressPercent(completed: number, total: number): number {
  if (total === 0 || completed === 0) return 0;
  return Math.max(1, Math.floor((completed / total) * 100));
}
