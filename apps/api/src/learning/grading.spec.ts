import { certificateSerial, gradeQuiz } from './grading';

const q1 = { id: 'q1', explanation: 'because', options: [{ id: 'a', isCorrect: true }, { id: 'b', isCorrect: false }] };
const q2 = {
  id: 'q2',
  explanation: null,
  options: [{ id: 'c', isCorrect: true }, { id: 'd', isCorrect: true }, { id: 'e', isCorrect: false }],
};

describe('gradeQuiz', () => {
  it('scores exact matches only', () => {
    const result = gradeQuiz([q1, q2], { q1: ['a'], q2: ['c'] }, 50);
    expect(result.scorePercent).toBe(50);
    expect(result.passed).toBe(true);
    expect(result.questions[1]).toMatchObject({ correct: false, correctOptionIds: ['c', 'd'] });
  });

  it('fails below the pass mark', () => {
    expect(gradeQuiz([q1, q2], { q1: ['b'], q2: ['c', 'd'] }, 60)).toMatchObject({ scorePercent: 50, passed: false });
  });

  it('ignores unknown and duplicate option ids', () => {
    const result = gradeQuiz([q2], { q2: ['c', 'd', 'd', 'zzz'] }, 100);
    expect(result).toMatchObject({ scorePercent: 100, passed: true });
    expect(result.questions[0]!.selectedOptionIds).toEqual(['c', 'd']);
  });

  it('treats unanswered questions as wrong', () => {
    expect(gradeQuiz([q1], {}, 60).scorePercent).toBe(0);
  });
});

describe('certificateSerial', () => {
  it('is readable and unambiguous', () => {
    expect(certificateSerial(() => 0, 2026)).toBe('OBG-2026-222222');
    expect(certificateSerial((n) => Math.floor(Math.random() * n))).toMatch(/^OBG-\d{4}-[2-9A-HJ-NP-Z]{6}$/);
  });
});
