import { z } from 'zod';

export const LESSON_KINDS = ['VIDEO', 'PDF', 'SIMULATOR', 'LIVE_CLASS', 'QUIZ', 'ASSIGNMENT', 'IMAGING'] as const;
export const LessonKindSchema = z.enum(LESSON_KINDS);
export type LessonKind = z.infer<typeof LessonKindSchema>;

/** Lesson kinds an instructor can create today. Others arrive in later phases. */
export const AUTHORABLE_LESSON_KINDS = ['VIDEO', 'PDF', 'QUIZ', 'ASSIGNMENT', 'IMAGING'] as const;

export const COURSE_LEVELS = ['BEGINNER', 'INTERMEDIATE', 'ADVANCED'] as const;
export const CourseLevelSchema = z.enum(COURSE_LEVELS);
export type CourseLevel = z.infer<typeof CourseLevelSchema>;

export const COURSE_STATUSES = ['DRAFT', 'IN_REVIEW', 'PUBLISHED', 'RETIRED'] as const;
export const CourseStatusSchema = z.enum(COURSE_STATUSES);
export type CourseStatus = z.infer<typeof CourseStatusSchema>;

/** Teaching languages offered in the course form. */
export const COURSE_LANGUAGES = ['en', 'hi', 'bn', 'ta', 'te', 'mr', 'gu', 'kn', 'ml'] as const;

export const InstructorSummarySchema = z.object({
  id: z.string().uuid(),
  displayName: z.string(),
  headline: z.string().nullable(),
});
export type InstructorSummary = z.infer<typeof InstructorSummarySchema>;

export const PriceSchema = z.object({
  isFree: z.boolean(),
  /** Paise. */
  pricePaise: z.number().int().nonnegative(),
  discountPricePaise: z.number().int().nonnegative().nullable(),
});
export type Price = z.infer<typeof PriceSchema>;

export const CourseSummarySchema = z.object({
  id: z.string().uuid(),
  slug: z.string(),
  title: z.string(),
  shortDescription: z.string(),
  level: CourseLevelSchema,
  language: z.string(),
  category: z.object({ slug: z.string(), name: z.string() }).nullable(),
  instructor: InstructorSummarySchema.nullable(),
  thumbnailAssetId: z.string().uuid().nullable(),
  lessonCount: z.number().int().nonnegative(),
  studentCount: z.number().int().nonnegative(),
  totalDurationSec: z.number().int().nonnegative(),
  price: PriceSchema,
  rating: z.object({ average: z.number().nullable(), count: z.number().int() }),
  publishedAt: z.string().datetime().nullable(),
});
export type CourseSummary = z.infer<typeof CourseSummarySchema>;

export const CourseListResponseSchema = z.object({
  items: z.array(CourseSummarySchema),
  total: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  pageSize: z.number().int().positive(),
});
export type CourseListResponse = z.infer<typeof CourseListResponseSchema>;

export const COURSE_SORTS = ['newest', 'popular', 'price_asc', 'price_desc', 'title'] as const;
export const CourseSortSchema = z.enum(COURSE_SORTS);
export type CourseSort = z.infer<typeof CourseSortSchema>;

export const LessonSummarySchema = z.object({
  id: z.string().uuid(),
  position: z.number().int(),
  title: z.string(),
  kind: LessonKindSchema,
  isPreview: z.boolean(),
  durationSec: z.number().int().nullable(),
});
export type LessonSummary = z.infer<typeof LessonSummarySchema>;

export const ChapterSummarySchema = z.object({
  id: z.string().uuid(),
  position: z.number().int(),
  title: z.string(),
  lessons: z.array(LessonSummarySchema),
});
export type ChapterSummary = z.infer<typeof ChapterSummarySchema>;

export const CourseDetailSchema = CourseSummarySchema.extend({
  description: z.string(),
  tags: z.array(z.string()),
  learnings: z.array(z.string()),
  requirements: z.array(z.string()),
  certificateEnabled: z.boolean(),
  /** Set when learners must pass an entrance test before enrolling. */
  entranceTest: z
    .object({ questionCount: z.number().int(), passPercent: z.number().int(), maxAttempts: z.number().int().nullable() })
    .nullable(),
  previewAssetId: z.string().uuid().nullable(),
  metaTitle: z.string().nullable(),
  metaDescription: z.string().nullable(),
  chapters: z.array(ChapterSummarySchema),
});
export type CourseDetail = z.infer<typeof CourseDetailSchema>;

export const LessonDetailSchema = LessonSummarySchema.extend({
  description: z.string().nullable(),
  courseSlug: z.string(),
  courseTitle: z.string(),
  mediaAssetId: z.string().uuid().nullable(),
});
export type LessonDetail = z.infer<typeof LessonDetailSchema>;

export const EnrollmentStatusSchema = z.object({ enrolled: z.boolean() });

/** Price the learner pays, in paise. */
export function effectivePricePaise(price: Price): number {
  if (price.isFree) return 0;
  return price.discountPricePaise ?? price.pricePaise;
}

/** Formats paise as Indian rupees, e.g. 149900 → "₹1,499". */
export function formatInr(paise: number, locale = 'en-IN'): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: paise % 100 === 0 ? 0 : 2,
  }).format(paise / 100);
}
