import { z } from 'zod';
import { LearnerTypeSchema, RoleSchema } from './roles.js';

/** Site languages a user can choose. English only (Hindi removed, 2026-11-26). */
export const SUPPORTED_LOCALES = ['en'] as const;
export const LocaleSchema = z.enum(SUPPORTED_LOCALES);

export const UserProfileSchema = z.object({
  id: z.string().uuid(),
  displayName: z.string(),
  headline: z.string().nullable(),
  role: RoleSchema,
  learnerType: LearnerTypeSchema.nullable(),
  locale: z.string(),
  phone: z.string().nullable(),
  email: z.string().nullable(),
  /** Profile picture (public image, served at /files/:id), or null. */
  avatarAssetId: z.string().uuid().nullable().default(null),
});
export type UserProfile = z.infer<typeof UserProfileSchema>;

export const UpdateProfileSchema = z.object({
  displayName: z.string().trim().min(1).max(100).optional(),
  headline: z.string().trim().max(120).optional(),
  bio: z.string().trim().max(3000).optional(),
  locale: LocaleSchema.optional(),
  learnerType: LearnerTypeSchema.optional(),
  /** A READY image the user uploaded with purpose AVATAR; null removes the picture. */
  avatarAssetId: z.string().uuid().nullable().optional(),
});
export type UpdateProfile = z.infer<typeof UpdateProfileSchema>;

export const DeviceSchema = z.object({
  id: z.string().uuid(),
  label: z.string().nullable(),
  createdAt: z.string().datetime(),
  lastSeenAt: z.string().datetime(),
  current: z.boolean(),
});
export type Device = z.infer<typeof DeviceSchema>;
