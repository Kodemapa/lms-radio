import 'server-only';
import { type UserProfile } from '@obgyn/types';
import { redirect } from 'next/navigation';
import { getMe } from './catalog';

export async function requireAdmin(locale: string, path: string): Promise<UserProfile> {
  const me = await getMe();
  if (!me) redirect(`/${locale}/login?next=${encodeURIComponent(`/${locale}${path}`)}`);
  if (me.role !== 'ADMIN') {
    redirect(me.role === 'LEARNER' ? `/${locale}/` : `/${locale}/instructor`);
  }
  return me;
}
