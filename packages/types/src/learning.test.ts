import { describe, expect, it } from 'vitest';
import { QuestionInputSchema, progressPercent, unlockedUntilSec } from './learning.js';
import { submissionProblems } from './submission.js';

describe('QuestionInputSchema', () => {
  const base = { text: 'Q', explanation: null, allowMultiple: false };
  it('needs a correct answer', () => {
    expect(
      QuestionInputSchema.safeParse({ ...base, options: [{ text: 'a', isCorrect: false }, { text: 'b', isCorrect: false }] }).success,
    ).toBe(false);
  });
  it('allows one correct answer for single-choice questions', () => {
    const two = [{ text: 'a', isCorrect: true }, { text: 'b', isCorrect: true }];
    expect(QuestionInputSchema.safeParse({ ...base, options: two }).success).toBe(false);
    expect(QuestionInputSchema.safeParse({ ...base, allowMultiple: true, options: two }).success).toBe(true);
  });
});

describe('progressPercent', () => {
  it('rounds down', () => {
    expect(progressPercent(0, 0)).toBe(0);
    expect(progressPercent(199, 200)).toBe(99);
    expect(progressPercent(3, 3)).toBe(100);
  });
  it('shows at least 1% once anything is done', () => {
    expect(progressPercent(1, 140)).toBe(1);
    expect(progressPercent(0, 140)).toBe(0);
  });
});

describe('submissionProblems for quizzes and assignments', () => {
  const course = {
    title: 'Course title',
    shortDescription: 'A description long enough to pass.',
    description: '',
    categoryId: 'c',
    thumbnailAssetId: 't',
    learnings: ['x'],
    tags: [],
    requirements: [],
    isFree: true,
    pricePaise: 0,
    discountPricePaise: null,
  };
  it('flags empty quizzes and assignments', () => {
    const { problems } = submissionProblems({
      ...course,
      chapters: [
        {
          title: 'c',
          description: null,
          lessons: [
            { title: 'q', description: null, kind: 'QUIZ', media: null, questionCount: 0 },
            { title: 'a', description: null, kind: 'ASSIGNMENT', media: null, instructions: ' ' },
          ],
        },
      ],
    });
    expect(problems).toEqual(['QUIZ_EMPTY', 'ASSIGNMENT_EMPTY']);
  });
  it('screens quiz text for PC-PNDT', () => {
    const { problems } = submissionProblems({
      ...course,
      chapters: [
        {
          title: 'c',
          description: null,
          lessons: [
            {
              title: 'q',
              description: null,
              kind: 'QUIZ',
              media: null,
              questionCount: 1,
              extraText: ['Which sign predicts the sex of the fetus at 12 weeks?'],
            },
          ],
        },
      ],
    });
    expect(problems).toContain('PCPNDT');
  });
});

describe('unlockedUntilSec', () => {
  it('locks at the earliest unanswered checkpoint', () => {
    expect(unlockedUntilSec([{ atSec: 90, passed: false }, { atSec: 30, passed: false }])).toBe(30);
    expect(unlockedUntilSec([{ atSec: 30, passed: true }, { atSec: 90, passed: false }])).toBe(90);
  });
  it('unlocks the whole video when every checkpoint is passed', () => {
    expect(unlockedUntilSec([{ atSec: 30, passed: true }])).toBeNull();
    expect(unlockedUntilSec([])).toBeNull();
  });
  it('does not let a later pass skip an earlier unanswered question', () => {
    expect(unlockedUntilSec([{ atSec: 30, passed: false }, { atSec: 90, passed: true }])).toBe(30);
  });
});
