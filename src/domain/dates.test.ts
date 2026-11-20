import { describe, expect, it } from 'vitest';
import { addDays, atLocalTime, monthGrid, monthRange, parseDateStr, toDateStr, toTimeStr, weekday } from './dates';

// Tests run with TZ=Europe/Berlin (see package.json) so DST is exercised.
describe('dates', () => {
  it('formats local days, not UTC days', () => {
    // 00:30 local on 20 Nov = 23:30 UTC on 19 Nov: a UTC-based formatter would say the 19th.
    expect(toDateStr(new Date(2026, 10, 20, 0, 30))).toBe('2026-11-20');
  });

  it('round-trips and rejects invalid dates', () => {
    expect(toDateStr(parseDateStr('2026-02-28'))).toBe('2026-02-28');
    expect(() => parseDateStr('2026-02-30')).toThrow();
    expect(() => parseDateStr('19/11/2026')).toThrow();
  });

  it('uses Monday = 0', () => {
    expect(weekday('2026-11-16')).toBe(0); // Monday
    expect(weekday('2026-11-19')).toBe(3); // Thursday
    expect(weekday('2026-11-22')).toBe(6); // Sunday
  });

  it('adds days across DST and year boundaries', () => {
    expect(addDays('2026-10-24', 1)).toBe('2026-10-25'); // DST ends 25 Oct in Berlin
    expect(addDays('2026-10-25', 1)).toBe('2026-10-26');
    expect(addDays('2026-03-29', -1)).toBe('2026-03-28'); // DST starts 29 Mar
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
  });
});

describe('times', () => {
  it('round-trips local clock times', () => {
    const t = atLocalTime('2026-10-25', '09:05'); // DST change day in Berlin
    expect(toTimeStr(t)).toBe('09:05');
    expect(new Date(t).getDate()).toBe(25);
    expect(() => atLocalTime('2026-10-25', '24:00')).toThrow();
    expect(() => atLocalTime('2026-10-25', '9.05')).toThrow();
  });
});

describe('month grid', () => {
  it('lays out November 2026 Monday-first (1st is a Sunday)', () => {
    const g = monthGrid(2026, 10);
    expect(g[0]).toEqual([null, null, null, null, null, null, '2026-11-01']);
    expect(g[1][0]).toBe('2026-11-02');
    expect(g.at(-1)).toEqual(['2026-11-30', null, null, null, null, null, null]);
    expect(g.flat().filter(Boolean)).toHaveLength(30);
    expect(g.every((w) => w.length === 7)).toBe(true);
  });
  it('handles February, leap years and months starting on Monday', () => {
    expect(monthGrid(2028, 1).flat().filter(Boolean)).toHaveLength(29);
    expect(monthGrid(2027, 1)[0][0]).toBe('2027-02-01'); // Monday
    expect(monthGrid(2027, 1)).toHaveLength(4); // exactly 4 weeks
  });
  it('gives the first and last day of a month', () => {
    expect(monthRange(2026, 1)).toEqual({ first: '2026-02-01', last: '2026-02-28' });
    expect(monthRange(2026, 11)).toEqual({ first: '2026-12-01', last: '2026-12-31' });
  });
});
