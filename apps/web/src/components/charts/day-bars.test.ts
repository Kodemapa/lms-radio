import { describe, expect, it } from 'vitest';
import { axisTicks, niceMax } from './day-bars';

describe('niceMax', () => {
  it('rounds the axis top to a clean number', () => {
    expect(niceMax(0)).toBe(1);
    expect(niceMax(3)).toBe(3);
    expect(niceMax(7)).toBe(10);
    expect(niceMax(17)).toBe(20);
    expect(niceMax(23)).toBe(25);
    expect(niceMax(230)).toBe(250);
    expect(niceMax(1000)).toBe(1000);
  });
});

describe('axisTicks', () => {
  it('never repeats a tick and only uses whole midpoints', () => {
    expect(axisTicks(1)).toEqual([0, 1]);
    expect(axisTicks(5)).toEqual([0, 5]);
    expect(axisTicks(10)).toEqual([0, 5, 10]);
    expect(axisTicks(250)).toEqual([0, 125, 250]);
  });
});

