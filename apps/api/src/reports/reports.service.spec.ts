import { type AccessService } from '../courses/access.service';
import { type CoursePermissions } from '../courses/course-permissions';
import { type PrismaService } from '../prisma/prisma.service';
import { ReportsService } from './reports.service';

const T1 = '00000000-0000-4000-8000-0000000000a1';
const T2 = '00000000-0000-4000-8000-0000000000a2';
const at = (min: number) => new Date(Date.UTC(2026, 10, 16, 10, min));

/** A course with one video (2 in-video questions) and one quiz (3 questions). */
function setup() {
  const opt = (id: string, ok: boolean) => ({ id, isCorrect: ok });
  const prisma = {
    course: {
      findUniqueOrThrow: jest.fn().mockResolvedValue({
        id: 'c1', slug: 'c', title: 'Course', entranceTestEnabled: false,
        chapters: [{ id: 'ch1', title: 'Module 1', lessons: [
          { id: 'v1', title: 'Video', kind: 'VIDEO', durationSec: 600, passPercent: null, mediaAsset: { durationSec: 590 } },
          { id: 'q1', title: 'Quiz', kind: 'QUIZ', durationSec: null, passPercent: 60, mediaAsset: null },
          { id: 'a1', title: 'Assignment', kind: 'ASSIGNMENT', durationSec: null, passPercent: null, mediaAsset: null },
        ] }],
      }),
    },
    user: { findUniqueOrThrow: jest.fn().mockResolvedValue({ id: 'u1', displayName: 'Asha' }) },
    enrollment: { findUnique: jest.fn().mockResolvedValue({ createdAt: at(0) }) },
    questionTopic: { findMany: jest.fn().mockResolvedValue([{ id: T1, name: 'Dating' }, { id: T2, name: 'Doppler' }]) },
    lessonProgress: { findMany: jest.fn().mockResolvedValue([
      { lessonId: 'v1', views: 3, watchedSec: 400, furthestSec: 590, positionSec: 590, completedAt: at(5), skipped: false, updatedAt: at(5) },
    ]) },
    quizAttempt: { findMany: jest.fn().mockResolvedValue([
      { lessonId: 'q1', scorePercent: 33, passed: false, createdAt: at(10), answers: { qa: ['x'], qb: ['x'], qc: ['x'] } },
      { lessonId: 'q1', scorePercent: 67, passed: true, createdAt: at(20), answers: { qa: ['a'], qb: ['b'], qc: ['x'] } },
    ]) },
    imagingAttempt: { findMany: jest.fn().mockResolvedValue([]) },
    checkpointAnswer: { findMany: jest.fn().mockResolvedValue([
      { questionId: 'c1q', attempts: 1, passedAt: at(2) },
      { questionId: 'c2q', attempts: 3, passedAt: at(3) },
    ]) },
    quizQuestion: { findMany: jest.fn().mockResolvedValue([
      { id: 'c1q', lessonId: 'v1', atSec: 30, text: 'CP1', topicId: T1, explanation: null, options: [opt('a', true)] },
      { id: 'c2q', lessonId: 'v1', atSec: 90, text: 'CP2', topicId: T2, explanation: null, options: [opt('a', true)] },
      { id: 'qa', lessonId: 'q1', atSec: null, text: 'QA', topicId: T1, explanation: null, options: [opt('a', true), opt('x', false)] },
      { id: 'qb', lessonId: 'q1', atSec: null, text: 'QB', topicId: T1, explanation: null, options: [opt('b', true), opt('x', false)] },
      { id: 'qc', lessonId: 'q1', atSec: null, text: 'QC', topicId: T2, explanation: null, options: [opt('c', true), opt('x', false)] },
    ]) },
    assignmentSubmission: { findMany: jest.fn().mockResolvedValue([]) },
  };
  return new ReportsService(prisma as unknown as PrismaService, {} as CoursePermissions, {} as AccessService);
}

describe('learner report', () => {
  it('reports where the learner is, tries per lesson and strengths per topic', async () => {
    const report = await setup().build('c1', 'u1');
    const [video, quiz, assignment] = report.chapters[0]!.lessons;

    expect(report.overview).toMatchObject({ completedLessons: 1, totalLessons: 3, percent: 33, watchedSec: 400, quizAttempts: 2, averageQuizScore: 67, checkpointTries: 4, checkpointFirstTryPercent: 50 });
    expect(report.overview.lastLesson?.id).toBe('v1');
    expect(report.overview.nextLesson?.id).toBe('q1');

    expect(video).toMatchObject({ status: 'COMPLETED', views: 3, video: { durationSec: 590, watchedSec: 400 } });
    expect(video!.checkpoints).toMatchObject({ total: 2, passed: 2, attempts: 4, firstTry: 1 });
    expect(quiz).toMatchObject({ status: 'IN_PROGRESS', quiz: { attempts: 2, bestScore: 67, lastScore: 67, passed: true } });
    expect(quiz!.quiz!.history.map((h) => h.scorePercent)).toEqual([33, 67]);
    expect(assignment).toMatchObject({ status: 'NOT_STARTED', assignment: { status: 'NOT_SUBMITTED' } });

    // Dating: CP1 first try ✓, QA ✓, QB ✓ (latest quiz attempt) → 3/3. Doppler: CP2 needed 3 tries ✗, QC ✗ → 0/2.
    expect(report.topics).toEqual([
      expect.objectContaining({ name: 'Dating', answered: 3, correct: 3, level: 'STRONG', bySource: { QUIZ: 2, VIDEO: 1, ENTRANCE: 0 } }),
      expect.objectContaining({ name: 'Doppler', answered: 2, correct: 0, level: 'NOT_ENOUGH_DATA' }),
    ]);
  });
});
