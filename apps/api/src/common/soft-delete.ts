import { type Prisma } from '@prisma/client';

/**
 * Curriculum trash: chapters and lessons are soft-deleted (deletedAt). Every
 * query that shows or counts curriculum must use these filters, so trashed
 * items vanish for learners and instructors alike until restored.
 */
export const LIVE_CHAPTER = { deletedAt: null } satisfies Prisma.ChapterWhereInput;
export const LIVE_LESSON = { deletedAt: null, chapter: { deletedAt: null } } satisfies Prisma.LessonWhereInput;
