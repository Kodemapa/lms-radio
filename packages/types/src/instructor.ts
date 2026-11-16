import { z } from 'zod';
import {
  CourseLevelSchema,
  CourseStatusSchema,
  CourseSummarySchema,
  LessonKindSchema,
} from './course.js';

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
  passPercent: z.number().int().min(0).max(100).nullable(),
  instructions: z.string().trim().max(10_000).nullable(),
  points: z.number().int().min(0).max(1000).nullable(),
  submissionKinds: z.array(z.enum(['IMAGE', 'PDF'])).max(2),
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
  passPercent: z.number().int().nullable(),
  instructions: z.string().nullable(),
  points: z.number().int().nullable(),
  submissionKinds: z.array(z.enum(['IMAGE', 'PDF'])),
  questionCount: z.number().int(),
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

export const InstructorCourseSchema = z.object({
  id: z.string().uuid(),
  slug: z.string(),
  status: CourseStatusSchema,
  reviewNote: z.string().nullable(),
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

export const UPLOAD_LIMITS: Record<UploadKind, { maxBytes: number; mimeTypes: readonly string[] }> = {
  IMAGE: { maxBytes: 5 * 1024 * 1024, mimeTypes: ['image/jpeg', 'image/png', 'image/webp'] },
  VIDEO: { maxBytes: 4 * 1024 * 1024 * 1024, mimeTypes: ['video/mp4', 'video/webm'] },
  PDF: { maxBytes: 100 * 1024 * 1024, mimeTypes: ['application/pdf'] },
  /**
   * Case images: a DICOM Part 10 file (one image, possibly multi-frame), or a
   * PNG/JPEG screenshot converted to DICOM. De-identified server-side.
   */
  DICOM: { maxBytes: 200 * 1024 * 1024, mimeTypes: ['application/dicom', 'image/png', 'image/jpeg'] },
};

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
  courseCount: z.number().int(),
  studentCount: z.number().int(),
});
export type PublicInstructor = z.infer<typeof PublicInstructorSchema>;
