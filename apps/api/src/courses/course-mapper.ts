import { type CourseDetail, type CourseSummary } from '@obgyn/types';
import { Prisma } from '@prisma/client';
import { LIVE_LESSON } from '../common/soft-delete';

/** Everything needed to build a CourseSummary, in one query. */
export const COURSE_SUMMARY_INCLUDE = {
  category: { select: { slug: true, name: true } },
  instructor: { select: { id: true, displayName: true, headline: true, avatarAssetId: true } },
  lessons: { where: LIVE_LESSON, select: { durationSec: true } },
  // Reviews hidden by an admin don't count towards the rating.
  reviews: { where: { hiddenAt: null }, select: { rating: true } },
  _count: { select: { enrollments: true } },
} satisfies Prisma.CourseInclude;

export type CourseWithSummary = Prisma.CourseGetPayload<{ include: typeof COURSE_SUMMARY_INCLUDE }>;

export function toCourseSummary(course: CourseWithSummary): CourseSummary {
  return {
    id: course.id,
    slug: course.slug,
    title: course.title,
    shortDescription: course.shortDescription,
    level: course.level,
    language: course.language,
    category: course.category,
    instructor: course.instructor,
    thumbnailAssetId: course.thumbnailAssetId,
    lessonCount: course.lessons.length,
    studentCount: course._count.enrollments,
    totalDurationSec: course.lessons.reduce((sum, lesson) => sum + (lesson.durationSec ?? 0), 0),
    price: {
      isFree: course.isFree,
      pricePaise: course.pricePaise,
      discountPricePaise: course.discountPricePaise,
    },
    rating: {
      average: course.reviews.length
        ? Math.round((course.reviews.reduce((sum, r) => sum + r.rating, 0) / course.reviews.length) * 10) / 10
        : null,
      count: course.reviews.length,
    },
    publishedAt: course.publishedAt?.toISOString() ?? null,
  };
}

export const COURSE_DETAIL_INCLUDE = {
  ...COURSE_SUMMARY_INCLUDE,
  chapters: {
    where: { deletedAt: null },
    orderBy: { position: 'asc' },
    include: {
      lessons: {
        where: { deletedAt: null },
        orderBy: { position: 'asc' },
        select: { id: true, position: true, title: true, kind: true, isPreview: true, durationSec: true },
      },
    },
  },
} satisfies Prisma.CourseInclude;

export type CourseWithDetail = Prisma.CourseGetPayload<{ include: typeof COURSE_DETAIL_INCLUDE }>;

export function toCourseDetail(course: CourseWithDetail): CourseDetail {
  return {
    ...toCourseSummary(course),
    description: course.description,
    tags: course.tags,
    learnings: course.learnings,
    requirements: course.requirements,
    certificateEnabled: course.certificateEnabled,
    entranceTest: course.entranceTestEnabled
      ? {
          questionCount: course.entranceQuestionCount,
          passPercent: course.entrancePassPercent,
          maxAttempts: course.entranceMaxAttempts,
        }
      : null,
    previewAssetId: course.previewAssetId,
    metaTitle: course.metaTitle,
    metaDescription: course.metaDescription,
    chapters: course.chapters.map((chapter) => ({
      id: chapter.id,
      position: chapter.position,
      title: chapter.title,
      lessons: chapter.lessons,
    })),
  };
}
