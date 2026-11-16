import { type Role } from '@obgyn/types';

/** Attached to `req.user` by JwtAuthGuard. */
export interface AuthUser {
  userId: string;
  sessionId: string;
  role: Role;
}
