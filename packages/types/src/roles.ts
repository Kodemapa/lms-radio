import { z } from 'zod';

export const ROLES = ['LEARNER', 'FACULTY', 'ADMIN'] as const;
export const RoleSchema = z.enum(ROLES);
export type Role = z.infer<typeof RoleSchema>;

/** Staff roles may access any course without enrolling. */
export const STAFF_ROLES: readonly Role[] = ['FACULTY', 'ADMIN'];

export const LEARNER_TYPES = [
  'MBBS_STUDENT',
  'OBG_RESIDENT',
  'SONOLOGIST',
  'NURSE_MIDWIFE',
  'FACULTY',
  'OTHER',
] as const;
export const LearnerTypeSchema = z.enum(LEARNER_TYPES);
export type LearnerType = z.infer<typeof LearnerTypeSchema>;
