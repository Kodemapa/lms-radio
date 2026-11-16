import { z } from 'zod';
import { LearnerTypeSchema, RoleSchema } from './roles.js';

export const SUPPORTED_LOCALES = ['en', 'hi'] as const;
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
});
export type UserProfile = z.infer<typeof UserProfileSchema>;

export const UpdateProfileSchema = z.object({
  displayName: z.string().trim().min(1).max(100).optional(),
  headline: z.string().trim().max(120).optional(),
  bio: z.string().trim().max(3000).optional(),
  locale: LocaleSchema.optional(),
  learnerType: LearnerTypeSchema.optional(),
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
