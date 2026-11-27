import { z } from 'zod';
import { RoleSchema } from './roles.js';

export const ADMIN_USER_STATUSES = ['ACTIVE', 'BLOCKED', 'DELETED', 'ALL'] as const;
export const AdminUserStatusSchema = z.enum(ADMIN_USER_STATUSES);
export type AdminUserStatus = z.infer<typeof AdminUserStatusSchema>;

/** Rows-per-page choices offered on every admin list. */
export const ADMIN_PAGE_SIZES = [5, 10, 15, 25, 50, 100] as const;
/** Users list shows 5 rows by default; other admin lists show 10. */
export const ADMIN_USERS_DEFAULT_PAGE_SIZE = 5;
export const ADMIN_DEFAULT_PAGE_SIZE = 10;
/** Cookie remembering the admin's rows-per-page choice across admin screens. */
export const ADMIN_PAGE_SIZE_COOKIE = 'elms_admin_page_size';

export const AdminUsersQuerySchema = z.object({
  q: z.string().trim().max(100).default(''),
  role: RoleSchema.optional(),
  status: AdminUserStatusSchema.default('ACTIVE'),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(5),
  sortBy: z.enum(['createdAt', 'displayName']).default('createdAt'),
  order: z.enum(['asc', 'desc']).default('desc'),
});
export type AdminUsersQuery = z.infer<typeof AdminUsersQuerySchema>;

export const AdminUserListItemSchema = z.object({
  id: z.string().uuid(),
  displayName: z.string(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  role: RoleSchema,
  status: AdminUserStatusSchema.exclude(['ALL']),
  createdAt: z.string().datetime(),
  blockedAt: z.string().datetime().nullable(),
  deletedAt: z.string().datetime().nullable(),
});
export type AdminUserListItem = z.infer<typeof AdminUserListItemSchema>;

export const AdminUserListResponseSchema = z.object({
  items: z.array(AdminUserListItemSchema),
  page: z.number().int().positive(),
  pageSize: z.number().int().positive(),
  total: z.number().int().nonnegative(),
  totalPages: z.number().int().nonnegative(),
});
export type AdminUserListResponse = z.infer<typeof AdminUserListResponseSchema>;

export const AdminUserDetailSchema = z.object({
  user: z.object({
    id: z.string().uuid(),
    displayName: z.string(),
    email: z.string().nullable(),
    phone: z.string().nullable(),
    headline: z.string().nullable(),
    bio: z.string().nullable(),
    learnerType: z.string().nullable(),
    role: RoleSchema,
    createdAt: z.string().datetime(),
    blockedAt: z.string().datetime().nullable(),
    blockedReason: z.string().nullable(),
    blockedByName: z.string().nullable(),
    deletedAt: z.string().datetime().nullable(),
  }),
  enrollments: z.array(z.object({
    courseId: z.string().uuid(),
    courseTitle: z.string(),
    courseSlug: z.string(),
    enrolledAt: z.string().datetime(),
    /** Lessons completed of the course's live lessons. */
    progress: z.object({ completed: z.number().int(), total: z.number().int() }).default({ completed: 0, total: 0 }),
    certificateSerial: z.string().nullable().default(null),
    /** The course's instructor (the learner is "under" them for this course). */
    instructorId: z.string().uuid().nullable().default(null),
    instructorName: z.string().nullable().default(null),
    /** Last time the learner opened or progressed a lesson of this course. */
    lastActivityAt: z.string().datetime().nullable().default(null),
    /** Seconds of video actually watched in this course. */
    watchedSec: z.number().int().nonnegative().default(0),
  })),
  /**
   * Everything the person did as a learner. Kept whatever their role is now, so
   * a learner who became an instructor (or the reverse) keeps their history.
   */
  learning: z
    .object({
      submissions: z.array(z.object({
        courseTitle: z.string(),
        lessonTitle: z.string(),
        status: z.enum(['SUBMITTED', 'APPROVED', 'REJECTED']),
        updatedAt: z.string().datetime(),
      })),
      quizAttempts: z.array(z.object({
        courseTitle: z.string(),
        lessonTitle: z.string(),
        scorePercent: z.number().int(),
        passed: z.boolean(),
        createdAt: z.string().datetime(),
      })),
      entranceAttempts: z.array(z.object({
        courseTitle: z.string(),
        scorePercent: z.number().int().nullable(),
        passed: z.boolean().nullable(),
        startedAt: z.string().datetime(),
      })),
      reviews: z.array(z.object({
        courseId: z.string().uuid(),
        courseTitle: z.string(),
        rating: z.number().int(),
        comment: z.string().nullable(),
        createdAt: z.string().datetime(),
        reported: z.boolean(),
        hidden: z.boolean(),
      })),
      /** Proctored exam sittings (one per exam lesson). */
      exams: z
        .array(z.object({
          courseTitle: z.string(),
          lessonTitle: z.string(),
          status: z.enum(['IN_PROGRESS', 'SUBMITTED', 'TERMINATED', 'EXPIRED']),
          scorePercent: z.number().int().nullable(),
          passed: z.boolean().nullable(),
          reviewStatus: z.enum(['PENDING', 'CLEARED', 'FLAGGED']),
          startedAt: z.string().datetime(),
          submittedAt: z.string().datetime().nullable(),
        }))
        .default([]),
      /** Image (DICOM) case attempts. */
      imagingAttempts: z
        .array(z.object({
          courseTitle: z.string(),
          lessonTitle: z.string(),
          scorePercent: z.number().int(),
          passed: z.boolean(),
          createdAt: z.string().datetime(),
        }))
        .default([]),
    })
    .default({ submissions: [], quizAttempts: [], entranceAttempts: [], reviews: [], exams: [], imagingAttempts: [] }),
  /**
   * What the person teaches (as owner or accepted co-instructor). null for learners who
   * never taught a course.
   */
  teaching: z
    .object({
      totals: z.object({
        courses: z.number().int().nonnegative(),
        published: z.number().int().nonnegative(),
        /** Distinct learners enrolled across these courses. */
        students: z.number().int().nonnegative(),
        reviews: z.number().int().nonnegative(),
        averageRating: z.number().nullable(),
        /** Assignments and image-case working waiting for a grader. */
        pendingGrading: z.number().int().nonnegative(),
        certificates: z.number().int().nonnegative(),
      }),
      courses: z.array(z.object({
        id: z.string().uuid(),
        title: z.string(),
        slug: z.string(),
        status: z.enum(['DRAFT', 'IN_REVIEW', 'PUBLISHED', 'RETIRED']),
        role: z.enum(['OWNER', 'EDITOR', 'GRADER']),
        students: z.number().int().nonnegative(),
        lessons: z.number().int().nonnegative(),
        reviews: z.number().int().nonnegative(),
        averageRating: z.number().nullable(),
        certificates: z.number().int().nonnegative(),
      })),
      /** Most recent enrolments across these courses. */
      students: z.array(z.object({
        userId: z.string().uuid(),
        displayName: z.string(),
        courseTitle: z.string(),
        enrolledAt: z.string().datetime(),
        progress: z.object({ completed: z.number().int(), total: z.number().int() }),
      })),
    })
    .nullable()
    .default(null),
  /** Role changes and instructor applications, newest first. */
  roleHistory: z
    .array(z.object({
      kind: z.enum(['ROLE_CHANGED', 'APPLICATION']),
      from: z.string().nullable(),
      to: z.string().nullable(),
      /** APPLICATION: PENDING / APPROVED / REJECTED. */
      status: z.string().nullable(),
      note: z.string().nullable(),
      at: z.string().datetime(),
    }))
    .default([]),
  devices: z.array(z.object({
    id: z.string().uuid(),
    label: z.string().nullable(),
    createdAt: z.string().datetime(),
    lastSeenAt: z.string().datetime(),
    revokedAt: z.string().datetime().nullable(),
  })),
  activity: z.array(z.object({
    action: z.string(),
    resource: z.string(),
    resourceId: z.string().nullable(),
    createdAt: z.string().datetime(),
  })),
});
export type AdminUserDetail = z.infer<typeof AdminUserDetailSchema>;

export const AdminUserReasonSchema = z.object({
  reason: z.string().trim().min(3).max(500),
});

export const AdminUserRoleUpdateSchema = AdminUserReasonSchema.extend({
  role: RoleSchema,
});
