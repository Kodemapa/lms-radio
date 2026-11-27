import { findFetalSexDeterminationText } from './compliance.js';
import { type SubmissionProblem } from './instructor.js';

export interface SubmittableCourse {
  title: string;
  shortDescription: string;
  description: string;
  categoryId: string | null;
  thumbnailAssetId: string | null;
  learnings: string[];
  tags: string[];
  requirements: string[];
  isFree: boolean;
  pricePaise: number;
  discountPricePaise: number | null;
  chapters: {
    title: string;
    description: string | null;
    lessons: {
      title: string;
      description: string | null;
      kind: string;
      media: { status: string; deidentified: boolean } | null;
      /** QUIZ: number of questions. */
      questionCount?: number;
      /** ASSIGNMENT: instructions. */
      instructions?: string | null;
      /** Quiz questions/options and other lesson text to screen for PC-PNDT. */
      extraText?: string[];
    }[];
  }[];
}

/**
 * Whether every video and reading lesson needs its file before a course can be
 * submitted. Off for now so courses can go live while lectures are still being
 * recorded; learners see "file not uploaded yet" on those lessons. An uploaded
 * file that isn't de-identified still blocks review (CLAUDE.md rule 6).
 */
export const LESSON_FILES_REQUIRED = false;

/** Everything that blocks review, so the UI can list it all at once. */
export function submissionProblems(course: SubmittableCourse): {
  problems: SubmissionProblem[];
  pcpndtMatches: string[];
} {
  const problems: SubmissionProblem[] = [];
  if (course.title.trim().length < 5) problems.push('TITLE');
  if (course.shortDescription.trim().length < 20) problems.push('SHORT_DESCRIPTION');
  if (!course.categoryId) problems.push('CATEGORY');
  if (!course.thumbnailAssetId) problems.push('THUMBNAIL');
  if (course.learnings.length === 0) problems.push('LEARNINGS');

  const lessons = course.chapters.flatMap((chapter) => chapter.lessons);
  if (lessons.length === 0) problems.push('NO_LESSONS');
  const needsMedia = lessons.filter((lesson) => lesson.kind === 'VIDEO' || lesson.kind === 'PDF');
  const mediaBlocks = (media: { status: string; deidentified: boolean } | null) =>
    LESSON_FILES_REQUIRED
      ? media?.status !== 'READY' || !media.deidentified
      : media?.status === 'READY' && !media.deidentified;
  if (needsMedia.some((lesson) => mediaBlocks(lesson.media))) {
    problems.push('MEDIA_MISSING');
  }

  if (lessons.some((lesson) => lesson.kind === 'QUIZ' && !lesson.questionCount)) {
    problems.push('QUIZ_EMPTY');
  }
  if (lessons.some((lesson) => lesson.kind === 'ASSIGNMENT' && !lesson.instructions?.trim())) {
    problems.push('ASSIGNMENT_EMPTY');
  }

  if (!course.isFree) {
    const discountOk =
      course.discountPricePaise === null || course.discountPricePaise < course.pricePaise;
    if (course.pricePaise < 100 || !discountOk) problems.push('PRICING');
  }

  const text = [
    course.title,
    course.shortDescription,
    course.description,
    ...course.learnings,
    ...course.tags,
    ...course.requirements,
    ...course.chapters.flatMap((chapter) => [
      chapter.title,
      chapter.description ?? '',
      ...chapter.lessons.flatMap((lesson) => [
        lesson.title,
        lesson.description ?? '',
        lesson.instructions ?? '',
        ...(lesson.extraText ?? []),
      ]),
    ]),
  ].join('\n');
  const pcpndtMatches = findFetalSexDeterminationText(text);
  if (pcpndtMatches.length > 0) problems.push('PCPNDT');

  return { problems, pcpndtMatches };
}
