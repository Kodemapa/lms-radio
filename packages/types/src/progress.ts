import { z } from 'zod';
import { LessonKindSchema } from './course.js';

// ---- Topic mastery ------------------------------------------------------------------

/**
 * Teaching thresholds for the strengths / weaknesses report (not clinical
 * content). See docs/02-ARCHITECTURE.md "Decisions log".
 */
export const MASTERY = {
  /** At or above this % correct: strong. */
  strongPercent: 80,
  /** Below this % correct: needs work. In between: developing. */
  weakPercent: 60,
  /** Fewer answered questions than this: not enough data to judge. */
  minAnswered: 3,
} as const;

export const MasteryLevelSchema = z.enum(['STRONG', 'DEVELOPING', 'NEEDS_WORK', 'NOT_ENOUGH_DATA']);
export type MasteryLevel = z.infer<typeof MasteryLevelSchema>;

export function masteryLevel(correct: number, answered: number): MasteryLevel {
  if (answered < MASTERY.minAnswered) return 'NOT_ENOUGH_DATA';
  const percent = (correct / answered) * 100;
  if (percent >= MASTERY.strongPercent) return 'STRONG';
  if (percent < MASTERY.weakPercent) return 'NEEDS_WORK';
  return 'DEVELOPING';
}

/** One graded answer, from a quiz, an in-video question or the entrance test. */
export interface GradedAnswer {
  topicId: string | null;
  correct: boolean;
  source: 'QUIZ' | 'VIDEO' | 'ENTRANCE';
}

export const TopicMasterySchema = z.object({
  /** null = questions without a topic. */
  topicId: z.string().uuid().nullable(),
  name: z.string().nullable(),
  answered: z.number().int(),
  correct: z.number().int(),
  percent: z.number().int(),
  level: MasteryLevelSchema,
  /** Answers per source, so the report can say where the evidence comes from. */
  bySource: z.object({ QUIZ: z.number().int(), VIDEO: z.number().int(), ENTRANCE: z.number().int() }),
});
export type TopicMastery = z.infer<typeof TopicMasterySchema>;

/**
 * Groups graded answers by topic. Topics come back in the course's order;
 * topics with no answers yet are included (so learners see what is ahead),
 * and untagged questions come last.
 */
export function topicMastery(answers: GradedAnswer[], topics: { id: string; name: string }[]): TopicMastery[] {
  const rows = new Map<string | null, TopicMastery>();
  const row = (topicId: string | null, name: string | null) => {
    let r = rows.get(topicId);
    if (!r) {
      r = { topicId, name, answered: 0, correct: 0, percent: 0, level: 'NOT_ENOUGH_DATA', bySource: { QUIZ: 0, VIDEO: 0, ENTRANCE: 0 } };
      rows.set(topicId, r);
    }
    return r;
  };
  for (const t of topics) row(t.id, t.name);
  const known = new Set(topics.map((t) => t.id));
  for (const a of answers) {
    // A topic deleted after the answer was given counts as untagged.
    const r = row(a.topicId && known.has(a.topicId) ? a.topicId : null, null);
    r.answered += 1;
    if (a.correct) r.correct += 1;
    r.bySource[a.source] += 1;
  }
  return [...rows.values()]
    .filter((r) => r.topicId !== null || r.answered > 0)
    .map((r) => ({ ...r, percent: r.answered ? Math.round((r.correct / r.answered) * 100) : 0, level: masteryLevel(r.correct, r.answered) }));
}

// ---- Video watch time -----------------------------------------------------------------

/**
 * Seconds to add to a lesson's watch time for one progress report. Only
 * forward movement counts, and never more than the real time since the last
 * report (plus a little slack), so seeking ahead isn't counted as watching.
 */
export function watchedDelta(previousSec: number, positionSec: number, elapsedMs: number, slackSec = 5): number {
  const moved = positionSec - previousSec;
  if (moved <= 0) return 0;
  return Math.min(moved, Math.max(0, Math.floor(elapsedMs / 1000)) + slackSec);
}

// ---- Learner progress report -------------------------------------------------------------

export const LessonStatusSchema = z.enum(['COMPLETED', 'SKIPPED', 'IN_PROGRESS', 'NOT_STARTED']);
export type LessonStatus = z.infer<typeof LessonStatusSchema>;

const ScoreHistorySchema = z.object({ scorePercent: z.number().int(), passed: z.boolean(), at: z.string().datetime() });

const GradedSummarySchema = z.object({
  attempts: z.number().int(),
  bestScore: z.number().int().nullable(),
  lastScore: z.number().int().nullable(),
  passed: z.boolean(),
  passPercent: z.number().int(),
  /** Oldest first. */
  history: z.array(ScoreHistorySchema),
});

export const LessonReportSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  kind: LessonKindSchema,
  status: LessonStatusSchema,
  /** Times the learner opened the lesson. */
  views: z.number().int(),
  lastVisitedAt: z.string().datetime().nullable(),
  completedAt: z.string().datetime().nullable(),
  video: z
    .object({
      durationSec: z.number().int().nullable(),
      watchedSec: z.number().int(),
      furthestSec: z.number().int(),
    })
    .nullable(),
  /** In-video questions. */
  checkpoints: z
    .object({
      total: z.number().int(),
      passed: z.number().int(),
      /** Total tries across all in-video questions. */
      attempts: z.number().int(),
      /** Answered correctly on the first try. */
      firstTry: z.number().int(),
      questions: z.array(
        z.object({
          id: z.string().uuid(),
          text: z.string(),
          atSec: z.number().int(),
          topic: z.string().nullable(),
          attempts: z.number().int(),
          passed: z.boolean(),
        }),
      ),
    })
    .nullable(),
  quiz: GradedSummarySchema.nullable(),
  imaging: GradedSummarySchema.nullable(),
  assignment: z.object({ status: z.string() }).nullable(),
});
export type LessonReport = z.infer<typeof LessonReportSchema>;

const LessonPointerSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  chapterTitle: z.string(),
  kind: LessonKindSchema,
});

export const LearnerReportSchema = z.object({
  learner: z.object({ id: z.string().uuid(), displayName: z.string() }),
  course: z.object({ id: z.string().uuid(), slug: z.string(), title: z.string() }),
  overview: z.object({
    completedLessons: z.number().int(),
    totalLessons: z.number().int(),
    percent: z.number().int(),
    enrolledAt: z.string().datetime().nullable(),
    lastActivityAt: z.string().datetime().nullable(),
    /** The lesson the learner was on most recently. */
    lastLesson: LessonPointerSchema.nullable(),
    /** The first lesson they haven't finished, in course order. */
    nextLesson: LessonPointerSchema.nullable(),
    watchedSec: z.number().int(),
    quizAttempts: z.number().int(),
    /** Average of best quiz scores, over quizzes attempted. */
    averageQuizScore: z.number().int().nullable(),
    checkpointTries: z.number().int(),
    /** % of answered in-video questions right on the first try. */
    checkpointFirstTryPercent: z.number().int().nullable(),
    entrance: z.object({ passed: z.boolean(), attempts: z.number().int(), lastScore: z.number().int().nullable() }).nullable(),
  }),
  topics: z.array(TopicMasterySchema),
  chapters: z.array(
    z.object({
      id: z.string().uuid(),
      title: z.string(),
      completed: z.number().int(),
      total: z.number().int(),
      lessons: z.array(LessonReportSchema),
    }),
  ),
});
export type LearnerReport = z.infer<typeof LearnerReportSchema>;
