import { describe, expect, it } from 'vitest';
import { masteryLevel, topicMastery, watchedDelta, type GradedAnswer } from './progress.js';

const A = '00000000-0000-4000-8000-00000000000a';
const B = '00000000-0000-4000-8000-00000000000b';
const answers = (topicId: string | null, right: number, wrong: number, source: GradedAnswer['source'] = 'QUIZ'): GradedAnswer[] => [
  ...Array.from({ length: right }, () => ({ topicId, correct: true, source })),
  ...Array.from({ length: wrong }, () => ({ topicId, correct: false, source })),
];

describe('masteryLevel', () => {
  it('needs enough answers before judging', () => {
    expect(masteryLevel(2, 2)).toBe('NOT_ENOUGH_DATA');
  });
  it('uses the strong / weak thresholds', () => {
    expect(masteryLevel(4, 5)).toBe('STRONG'); // 80%
    expect(masteryLevel(3, 5)).toBe('DEVELOPING'); // 60%
    expect(masteryLevel(2, 5)).toBe('NEEDS_WORK'); // 40%
  });
});

describe('topicMastery', () => {
  const topics = [{ id: A, name: 'Dating' }, { id: B, name: 'Doppler' }];

  it('groups by topic in course order and counts sources', () => {
    const rows = topicMastery([...answers(B, 1, 3), ...answers(A, 4, 0, 'VIDEO'), ...answers(A, 1, 0, 'ENTRANCE')], topics);
    expect(rows.map((r) => r.name)).toEqual(['Dating', 'Doppler']);
    expect(rows[0]).toMatchObject({ answered: 5, correct: 5, percent: 100, level: 'STRONG', bySource: { QUIZ: 0, VIDEO: 4, ENTRANCE: 1 } });
    expect(rows[1]).toMatchObject({ answered: 4, percent: 25, level: 'NEEDS_WORK' });
  });

  it('keeps unanswered topics and puts untagged or deleted-topic answers last', () => {
    const rows = topicMastery([...answers(null, 1, 0), ...answers('00000000-0000-4000-8000-0000000000ff', 0, 1)], topics);
    expect(rows.map((r) => r.topicId)).toEqual([A, B, null]);
    expect(rows[0]).toMatchObject({ answered: 0, level: 'NOT_ENOUGH_DATA' });
    expect(rows[2]).toMatchObject({ answered: 2, correct: 1 });
  });

  it('omits the untagged row when every answer has a topic', () => {
    expect(topicMastery(answers(A, 1, 0), topics).some((r) => r.topicId === null)).toBe(false);
  });
});

describe('watchedDelta', () => {
  it('counts normal playback', () => {
    expect(watchedDelta(100, 110, 10_000)).toBe(10);
  });
  it('ignores rewinds', () => {
    expect(watchedDelta(100, 40, 10_000)).toBe(0);
  });
  it('caps a seek ahead at the real time elapsed plus slack', () => {
    expect(watchedDelta(0, 600, 10_000)).toBe(15);
  });
});
