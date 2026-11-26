import { describe, expect, it } from 'vitest';
import { examWindowState, ExamSettingsSchema, formatCountdown, integrityScore, secondsLeft } from './exam.js';

describe('exam timing', () => {
  it('formats a countdown', () => {
    expect(formatCountdown(0)).toBe('0:00');
    expect(formatCountdown(65)).toBe('1:05');
    expect(formatCountdown(3 * 3600 + 7)).toBe('3:00:07');
    expect(formatCountdown(-5)).toBe('0:00');
  });

  it('counts down on the server clock, not the device clock', () => {
    const now = Date.parse('2026-12-01T10:00:00Z');
    const endsAt = '2026-12-01T10:10:00Z';
    expect(secondsLeft(endsAt, 0, now)).toBe(600);
    // Device clock 2 minutes slow: the server is 120 s ahead.
    expect(secondsLeft(endsAt, 120_000, now)).toBe(480);
    expect(secondsLeft(endsAt, 0, now + 11 * 60_000)).toBe(0);
  });

  it('knows when an exam can be started', () => {
    const exam = { opensAt: '2026-12-01T09:00:00Z', closesAt: '2026-12-01T11:00:00Z' };
    expect(examWindowState(exam, new Date('2026-12-01T08:59:00Z'))).toBe('NOT_OPEN');
    expect(examWindowState(exam, new Date('2026-12-01T10:00:00Z'))).toBe('OPEN');
    expect(examWindowState(exam, new Date('2026-12-01T11:00:00Z'))).toBe('CLOSED');
    expect(examWindowState({ opensAt: null, closesAt: null }, new Date())).toBe('OPEN');
  });

  it('validates exam settings', () => {
    expect(ExamSettingsSchema.safeParse({ opensAt: null, closesAt: null, durationMin: 30, proctored: true }).success).toBe(true);
    expect(ExamSettingsSchema.safeParse({ opensAt: null, closesAt: null, durationMin: 0, proctored: true }).success).toBe(false);
    expect(
      ExamSettingsSchema.safeParse({ opensAt: '2026-12-01T10:00:00Z', closesAt: '2026-12-01T09:00:00Z', durationMin: 30, proctored: false }).success,
    ).toBe(false);
  });
});

describe('integrityScore', () => {
  it('is 100 and low risk with no alerts', () => {
    expect(integrityScore([])).toEqual({ score: 100, risk: 'LOW' });
  });

  it('takes points off per alert and ignores harmless events', () => {
    expect(integrityScore([{ kind: 'TAB_HIDDEN' }, { kind: 'MULTIPLE_FACES' }, { kind: 'STARTED' }, { kind: 'TAB_VISIBLE' }])).toEqual({
      score: 85,
      risk: 'LOW',
    });
  });

  it('does not count an automatic warning on top of the alert that caused it', () => {
    expect(integrityScore([{ kind: 'PROHIBITED_OBJECT' }, { kind: 'WARNING', auto: true }]).score).toBe(90);
    expect(integrityScore([{ kind: 'WARNING' }]).score).toBe(90);
  });

  it('never goes below 0 and marks high risk', () => {
    const many = Array.from({ length: 20 }, () => ({ kind: 'SECOND_SCREEN' as const }));
    expect(integrityScore(many)).toEqual({ score: 0, risk: 'HIGH' });
    expect(integrityScore(Array.from({ length: 4 }, () => ({ kind: 'MULTIPLE_FACES' as const }))).risk).toBe('MEDIUM');
  });
});

describe('ExamSettingsSchema defaults', () => {
  it('fills the new proctoring options for older saved settings', () => {
    expect(ExamSettingsSchema.parse({ opensAt: null, closesAt: null, durationMin: 30, proctored: true })).toMatchObject({
      aiMonitoring: false,
      autoWarn: false,
      maxWarnings: 0,
    });
  });
});
