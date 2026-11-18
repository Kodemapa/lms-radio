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
  })),
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
