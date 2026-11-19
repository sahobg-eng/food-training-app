import { describe, expect, it } from 'vitest';
import { formatChange, formatDay, formatDuration, formatKg, formatSet } from './format';

describe('format', () => {
  it('formats kg without trailing zeros', () => {
    expect(formatKg(100)).toBe('100');
    expect(formatKg(102.5)).toBe('102.5');
    expect(formatKg(12.25)).toBe('12.25');
  });
  it('formats durations', () => {
    expect(formatDuration(0)).toBe('0:00');
    expect(formatDuration(65)).toBe('1:05');
    expect(formatDuration(3600 + 2 * 60 + 7)).toBe('1:02:07');
  });
  it('formats days, adding the year only when different', () => {
    expect(formatDay('2026-11-14', 2026)).toBe('Sat 14 Nov');
    expect(formatDay('2025-12-31', 2026)).toBe('Wed 31 Dec 2025');
  });
  it('formats sets, with BW for bodyweight', () => {
    expect(formatSet({ weightKg: 100, reps: 5 })).toBe('100 × 5');
    expect(formatSet({ weightKg: 0, reps: 12 })).toBe('BW × 12');
  });
});

describe('formatChange', () => {
  it('signs changes and hides float noise', () => {
    expect(formatChange(0.4)).toBe('+0.4');
    expect(formatChange(82.1 - 82.7)).toBe('−0.6');
    expect(formatChange(1e-9)).toBe('±0');
  });
});
