import { describe, expect, it } from 'vitest';
import { addDays, parseDateStr, toDateStr, weekday } from './dates';

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
