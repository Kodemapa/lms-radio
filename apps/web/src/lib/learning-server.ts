import 'server-only';
import { PlayerLessonDetailSchema, PlayerOutlineSchema } from '@obgyn/types';
import { notFound, redirect } from 'next/navigation';
import { cache } from 'react';
import { ApiError, apiGet } from './server-api';

/** Outline for the player; sends visitors who can't open it to the right place. */
export const getOutline = cache(async (locale: string, slug: string) => {
  try {
    return await apiGet(`/learn/courses/${encodeURIComponent(slug)}`, PlayerOutlineSchema, { auth: true, onUnauthorized: 'throw' });
  } catch (error) {
    if (!(error instanceof ApiError)) throw error;
    if (error.status === 401) redirect(`/${locale}/login?next=${encodeURIComponent(`/${locale}/learn/${slug}`)}`);
    if (error.status === 403) redirect(`/${locale}/courses/${slug}`);
    notFound();
  }
});

export type LessonResult =
  | { ok: true; lesson: Awaited<ReturnType<typeof PlayerLessonDetailSchema.parse>> }
  | { ok: false; code: 'LOCKED_SEQUENCE' | 'NOT_ENROLLED' };

export async function getPlayerLesson(locale: string, slug: string, lessonId: string): Promise<LessonResult> {
  if (!/^[0-9a-f-]{36}$/i.test(lessonId)) notFound();
  try {
    const lesson = await apiGet(`/learn/lessons/${lessonId}`, PlayerLessonDetailSchema, { auth: true, onUnauthorized: 'throw' });
    if (lesson.course.slug !== slug) notFound();
    return { ok: true, lesson };
  } catch (error) {
    if (!(error instanceof ApiError)) throw error;
    if (error.status === 401) {
      redirect(`/${locale}/login?next=${encodeURIComponent(`/${locale}/learn/${slug}/${lessonId}`)}`);
    }
    const code = (error.body as { code?: string } | null)?.code;
    // Lessons stay closed until the entrance test is passed: send them to it.
    if (error.status === 403 && code === 'ENTRANCE_REQUIRED') redirect(`/${locale}/learn/${slug}/entrance`);
    if (error.status === 403 && (code === 'LOCKED_SEQUENCE' || code === 'NOT_ENROLLED')) return { ok: false, code };
    notFound();
  }
}
