import { describe, expect, it } from 'vitest';
import { initials } from './initials';

describe('initials', () => {
  it('skips the Dr title', () => expect(initials('Dr Meera Iyer')).toBe('MI'));
  it('handles single names', () => expect(initials('Learner 3210')).toBe('L3'));
  it('handles empty input', () => expect(initials('')).toBe(''));
});
