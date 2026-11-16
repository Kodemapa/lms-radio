import { describe, expect, it } from 'vitest';
import { parseClock } from './questions-dialog';

describe('parseClock', () => {
  it.each([
    ['1:30', 90],
    ['0:05', 5],
    ['90', 90],
    ['12:00', 720],
  ])('%s → %i', (input, seconds) => expect(parseClock(input)).toBe(seconds));
  it.each(['', '1:75', 'abc', '-3', '1:2:3'])('rejects %p', (input) => expect(parseClock(input)).toBeNull());
});
