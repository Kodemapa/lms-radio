import 'server-only';
import { type UserProfile } from '@obgyn/types';
import { redirect } from 'next/navigation';
import { getMe } from './catalog';

/** Instructor pages: signed-in FACULTY or ADMIN only. */
export async function requireInstructor(locale: string, path: string): Promise<UserProfile> {
  const me = await getMe();
  if (!me) redirect(`/${locale}/login?next=${encodeURIComponent(`/${locale}${path}`)}`);
  if (me.role === 'LEARNER') redirect(`/${locale}/become-instructor`);
  return me;
}
