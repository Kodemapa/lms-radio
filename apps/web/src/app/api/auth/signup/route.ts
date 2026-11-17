import { SignupSchema } from '@obgyn/types';
import { createAuthSession } from '@/lib/auth-session-route';

export function POST(req: Request) {
  return createAuthSession(req, 'signup', SignupSchema);
}
