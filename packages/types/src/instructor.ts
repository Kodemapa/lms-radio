import { ExamSettingsSchema } from './exam.js';
import { z } from 'zod';
import {
  CourseLevelSchema,
  CourseStatusSchema,
  CourseSummarySchema,
  LessonKindSchema,
} from './course.js';
import { CourseInvitationSchema, CourseRoleSchema, DayCountSchema } from './teaching.js';

const slugish = z.string().trim();
const listItem = z.string().trim().min(1).max(200);

// ---- Course authoring -------------------------------------------------------

export const CourseDetailsInputSchema = z.object({
  title: slugish.min(5, 'Title must be at least 5 characters').max(120),
  shortDescription: z.string().trim().max(300),
  description: z.string().trim().max(20_000),
  categoryId: z.string().uuid().nullable(),
  level: CourseLevelSchema,
  language: z.string().min(2).max(10),
  tags: z.array(z.string().trim().min(1).max(40)).max(15),
  learnings: z.array(listItem).max(20),
  requirements: z.array(listItem).max(20),
  sequentialAccess: z.boolean(),
  thumbnailAssetId: z.string().uuid().nullable(),
  previewAssetId: z.string().uuid().nullable(),
  metaTitle: z.string().trim().max(70).nullable(),
  metaDescription: z.string().trim().max(160).nullable(),
  metaKeywords: z.string().trim().max(200).nullable(),
});
export type CourseDetailsInput = z.infer<typeof CourseDetailsInputSchema>;

export const CreateCourseSchema = CourseDetailsInputSchema.pick({ title: true });
export type CreateCourse = z.infer<typeof CreateCourseSchema>;

export const CoursePricingInputSchema = z
  .object({
    isFree: z.boolean(),
    pricePaise: z.number().int().min(0).max(10_000_000),
    discountPricePaise: z.number().int().min(0).nullable(),
    certificateEnabled: z.boolean(),
    certificateFeePaise: z.number().int().min(0).max(1_000_000).nullable(),
  })
  .superRefine((value, ctx) => {
    if (!value.isFree && value.pricePaise < 100) {
      ctx.addIssue({ code: 'custom', path: ['pricePaise'], message: 'Paid courses cost at least ₹1' });
    }
    if (value.discountPricePaise !== null && value.discountPricePaise >= value.pricePaise) {
      ctx.addIssue({
        code: 'custom',
        path: ['discountPricePaise'],
        message: 'Discount price must be lower than the price',
      });
    }
  });
export type CoursePricingInput = z.infer<typeof CoursePricingInputSchema>;

export const ChapterInputSchema = z.object({
  title: z.string().trim().min(1).max(150),
  description: z.string().trim().max(1000).nullable(),
});
export type ChapterInput = z.infer<typeof ChapterInputSchema>;

export const LessonInputSchema = z.object({
  title: z.string().trim().min(1).max(150),
  description: z.string().trim().max(2000).nullable(),
  kind: z.enum(['VIDEO', 'PDF', 'QUIZ', 'ASSIGNMENT', 'IMAGING']),
  isPreview: z.boolean(),
  mediaAssetId: z.string().uuid().nullable(),
  skippable: z.boolean(),
  /** PDF only: learners may download a copy stamped with their name and user ID. */
  allowDownload: z.boolean().default(false),
  passPercent: z.number().int().min(0).max(100).nullable(),
  instructions: z.string().trim().max(10_000).nullable(),
  points: z.number().int().min(0).max(1000).nullable(),
  submissionKinds: z.array(z.enum(['IMAGE', 'PDF'])).max(2),
  /** QUIZ only: make it a timed (optionally proctored) exam; null = practice quiz. */
  exam: ExamSettingsSchema.nullable().default(null),
});
export type LessonInput = z.infer<typeof LessonInputSchema>;

export const ReorderSchema = z.object({ ids: z.array(z.string().uuid()).min(1).max(500) });

export const InstructorLessonSchema = z.object({
  id: z.string().uuid(),
  position: z.number().int(),
  title: z.string(),
  description: z.string().nullable(),
  kind: LessonKindSchema,
  isPreview: z.boolean(),
  durationSec: z.number().int().nullable(),
  mediaAssetId: z.string().uuid().nullable(),
  skippable: z.boolean(),
  allowDownload: z.boolean().default(false),
  passPercent: z.number().int().nullable(),
  instructions: z.string().nullable(),
  points: z.number().int().nullable(),
  submissionKinds: z.array(z.enum(['IMAGE', 'PDF'])),
  questionCount: z.number().int(),
  exam: ExamSettingsSchema.nullable(),
  media: z
    .object({
      status: z.enum(['PENDING', 'READY']),
      originalName: z.string().nullable(),
      deidentified: z.boolean(),
    })
    .nullable(),
});
export type InstructorLesson = z.infer<typeof InstructorLessonSchema>;

export const InstructorChapterSchema = z.object({
  id: z.string().uuid(),
  position: z.number().int(),
  title: z.string(),
  description: z.string().nullable(),
  lessons: z.array(InstructorLessonSchema),
});
export type InstructorChapter = z.infer<typeof InstructorChapterSchema>;

/** One step in a course's review: submitted, changes requested (with note), published, withdrawn. */
export const COURSE_REVIEW_KINDS = ['SUBMITTED', 'CHANGES_REQUESTED', 'PUBLISHED', 'WITHDRAWN'] as const;
export const CourseReviewKindSchema = z.enum(COURSE_REVIEW_KINDS);
export type CourseReviewKind = z.infer<typeof CourseReviewKindSchema>;

export const CourseReviewEventSchema = z.object({
  id: z.string().uuid(),
  kind: CourseReviewKindSchema,
  note: z.string().nullable(),
  /** Who did it (instructor or admin); null if the account was removed. */
  actorName: z.string().nullable(),
  createdAt: z.string().datetime(),
});
export type CourseReviewEvent = z.infer<typeof CourseReviewEventSchema>;

/** Admin: recent review steps across all courses, newest first. */
export const AdminReviewHistorySchema = z.object({
  items: z.array(
    CourseReviewEventSchema.extend({
      course: z.object({ id: z.string().uuid(), title: z.string(), slug: z.string(), status: CourseStatusSchema }),
      instructorName: z.string().nullable(),
    }),
  ),
  total: z.number().int(),
  page: z.number().int(),
  pageSize: z.number().int(),
});
export type AdminReviewHistory = z.infer<typeof AdminReviewHistorySchema>;

export const InstructorCourseSchema = z.object({
  id: z.string().uuid(),
  /** My role on this course: what the editor lets me change. */
  myRole: CourseRoleSchema,
  slug: z.string(),
  status: CourseStatusSchema,
  reviewNote: z.string().nullable(),
  /** Review steps, newest first. */
  reviewHistory: z.array(CourseReviewEventSchema).default([]),
  title: z.string(),
  shortDescription: z.string(),
  description: z.string(),
  categoryId: z.string().uuid().nullable(),
  level: CourseLevelSchema,
  language: z.string(),
  tags: z.array(z.string()),
  learnings: z.array(z.string()),
  requirements: z.array(z.string()),
  sequentialAccess: z.boolean(),
  thumbnailAssetId: z.string().uuid().nullable(),
  previewAssetId: z.string().uuid().nullable(),
  metaTitle: z.string().nullable(),
  metaDescription: z.string().nullable(),
  metaKeywords: z.string().nullable(),
  isFree: z.boolean(),
  pricePaise: z.number().int(),
  discountPricePaise: z.number().int().nullable(),
  certificateEnabled: z.boolean(),
  certificateFeePaise: z.number().int().nullable(),
  chapters: z.array(InstructorChapterSchema),
  updatedAt: z.string().datetime(),
});
export type InstructorCourse = z.infer<typeof InstructorCourseSchema>;

export const InstructorCourseRowSchema = z.object({
  id: z.string().uuid(),
  slug: z.string(),
  title: z.string(),
  status: CourseStatusSchema,
  thumbnailAssetId: z.string().uuid().nullable(),
  lessonCount: z.number().int(),
  studentCount: z.number().int(),
  isFree: z.boolean(),
  pricePaise: z.number().int(),
  discountPricePaise: z.number().int().nullable(),
  updatedAt: z.string().datetime(),
  myRole: CourseRoleSchema,
  /** Set when an admin sent the course back: the reviewer's note (may be empty). */
  changesRequested: z.object({ note: z.string().nullable() }).nullable().default(null),
});
export type InstructorCourseRow = z.infer<typeof InstructorCourseRowSchema>;

export const InstructorDashboardSchema = z.object({
  totalCourses: z.number().int(),
  published: z.number().int(),
  inReview: z.number().int(),
  drafts: z.number().int(),
  totalStudents: z.number().int(),
  totalLessons: z.number().int(),
  recentCourses: z.array(InstructorCourseRowSchema),
  /** Enrolments across my courses, last 30 days (oldest first, zero-filled). */
  enrolmentsByDay: z.array(DayCountSchema),
  /** Learners with progress in the last 7 days. */
  activeLearners: z.number().int(),
  /** Lesson completions in the last 30 days. */
  completions30d: z.number().int(),
  pendingSubmissions: z.number().int(),
  invitations: z.array(CourseInvitationSchema),
});
export type InstructorDashboard = z.infer<typeof InstructorDashboardSchema>;

/** Why a course can't be submitted for review yet. */
export const SUBMISSION_PROBLEMS = [
  'TITLE',
  'SHORT_DESCRIPTION',
  'CATEGORY',
  'THUMBNAIL',
  'LEARNINGS',
  'NO_LESSONS',
  'MEDIA_MISSING',
  'QUIZ_EMPTY',
  'ASSIGNMENT_EMPTY',
  'PRICING',
  'PCPNDT',
] as const;
export type SubmissionProblem = (typeof SUBMISSION_PROBLEMS)[number];

// ---- Uploads ----------------------------------------------------------------

export const UPLOAD_KINDS = ['IMAGE', 'VIDEO', 'PDF', 'DICOM'] as const;
export const UploadKindSchema = z.enum(UPLOAD_KINDS);
export type UploadKind = z.infer<typeof UploadKindSchema>;

/** PowerPoint: .ppt and .pptx. */
export const SLIDE_MIME_TYPES = [
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
] as const;

/** What a PDF lesson may hold: the protected viewer renders PDF only. */
export const LESSON_DOCUMENT_TYPES = ['application/pdf'] as const;

export const UPLOAD_LIMITS: Record<UploadKind, { maxBytes: number; mimeTypes: readonly string[] }> = {
  IMAGE: { maxBytes: 5 * 1024 * 1024, mimeTypes: ['image/jpeg', 'image/png', 'image/webp'] },
  VIDEO: { maxBytes: 4 * 1024 * 1024 * 1024, mimeTypes: ['video/mp4', 'video/webm'] },
  /**
   * Documents. PowerPoint is accepted for files a reviewer opens (assignment
   * submissions, imaging working); lesson documents must be PDF (see LESSON_DOCUMENT_TYPES)
   * because the protected in-app viewer only renders PDF.
   */
  PDF: { maxBytes: 100 * 1024 * 1024, mimeTypes: ['application/pdf', ...SLIDE_MIME_TYPES] },
  /**
   * Case images: a DICOM Part 10 file (one image, possibly multi-frame), or a
   * PNG/JPEG screenshot converted to DICOM. De-identified server-side.
   */
  DICOM: { maxBytes: 200 * 1024 * 1024, mimeTypes: ['application/dicom', 'image/png', 'image/jpeg'] },
};

/** Profile pictures are small images. */
export const AVATAR_MAX_BYTES = 2 * 1024 * 1024;

export const CreateUploadSchema = z.object({
  kind: UploadKindSchema,
  mimeType: z.string(),
  sizeBytes: z.number().int().positive(),
  fileName: z.string().max(200),
  /**
   * Uploader confirms the file has no patient-identifying information
   * (CLAUDE.md rule 6). Required for VIDEO and PDF.
   */
  deidentified: z.boolean(),
  /** AVATAR: a profile picture (IMAGE, at most AVATAR_MAX_BYTES, public, no clinical content). */
  purpose: z.enum(['AVATAR']).optional(),
});
export type CreateUpload = z.infer<typeof CreateUploadSchema>;

export const UploadTicketSchema = z.object({
  assetId: z.string().uuid(),
  uploadUrl: z.string().url(),
  method: z.literal('PUT'),
  headers: z.record(z.string()),
  expiresAt: z.string().datetime(),
});
export type UploadTicket = z.infer<typeof UploadTicketSchema>;

// ---- Instructor applications ------------------------------------------------

export const InstructorApplicationInputSchema = z.object({
  headline: z.string().trim().min(5).max(120),
  bio: z.string().trim().min(50, 'Tell us a little more (at least 50 characters)').max(3000),
  qualifications: z.string().trim().min(2).max(500),
  experienceYears: z.number().int().min(0).max(60),
  registrationNumber: z.string().trim().max(50).nullable(),
  /** Answers to admin-defined extra questions, keyed by field key (see `ApplicationField`). */
  answers: z.record(z.union([z.string().max(3000), z.number()])).default({}),
});
export type InstructorApplicationInput = z.infer<typeof InstructorApplicationInputSchema>;

export const ApplicationStatusSchema = z.enum(['PENDING', 'APPROVED', 'REJECTED']);

export const InstructorApplicationSchema = InstructorApplicationInputSchema.extend({
  id: z.string().uuid(),
  status: ApplicationStatusSchema,
  reviewNote: z.string().nullable(),
  createdAt: z.string().datetime(),
  applicant: z.object({
    id: z.string().uuid(),
    displayName: z.string(),
    email: z.string().nullable(),
    phone: z.string().nullable(),
  }),
});
export type InstructorApplication = z.infer<typeof InstructorApplicationSchema>;

export const ReviewDecisionSchema = z.object({ note: z.string().trim().max(1000).nullable() });

export const ReviewQueueItemSchema = CourseSummarySchema.extend({
  submittedAt: z.string().datetime().nullable(),
});
export type ReviewQueueItem = z.infer<typeof ReviewQueueItemSchema>;

export const PublicInstructorSchema = z.object({
  id: z.string().uuid(),
  displayName: z.string(),
  headline: z.string().nullable(),
  bio: z.string().nullable(),
  /** Profile picture (public image), or null. */
  avatarAssetId: z.string().uuid().nullable().default(null),
  courseCount: z.number().int(),
  studentCount: z.number().int(),
});
export type PublicInstructor = z.infer<typeof PublicInstructorSchema>;
