import { describe, expect, it } from 'vitest';
import type { MacroTarget, ScheduleVersion } from '../db/types';
import { dayTypeFor, kcalFromMacros, scheduledDayType, targetFor, versionFor } from './macros';

const sched = (effectiveFrom: string, workoutWeekdays: number[]): ScheduleVersion => ({ id: effectiveFrom, effectiveFrom, workoutWeekdays });
const target = (dayType: 'workout' | 'rest', effectiveFrom: string, kcal: number): MacroTarget => ({
  id: dayType + effectiveFrom, dayType, effectiveFrom, kcal, proteinG: 0, carbsG: 0, fatG: 0,
});

describe('versionFor', () => {
  const vs = [{ effectiveFrom: '2026-11-10' }, { effectiveFrom: '2026-11-01' }, { effectiveFrom: '2026-11-20' }];
  it('picks the latest version on or before the date', () => {
    expect(versionFor(vs, '2026-11-15')?.effectiveFrom).toBe('2026-11-10');
    expect(versionFor(vs, '2026-11-10')?.effectiveFrom).toBe('2026-11-10');
    expect(versionFor(vs, '2026-12-31')?.effectiveFrom).toBe('2026-11-20');
  });
  it('uses the first version for days before it, and null with none', () => {
    expect(versionFor(vs, '2026-10-01')?.effectiveFrom).toBe('2026-11-01');
    expect(versionFor([], '2026-11-15')).toBeNull();
  });
});

describe('day type', () => {
  // Mon/Wed/Fri until 15 Nov, then Tue/Thu/Sat
  const schedules = [sched('2026-11-01', [0, 2, 4]), sched('2026-11-16', [1, 3, 5])];
  it('follows the schedule in force on that day', () => {
    expect(scheduledDayType('2026-11-09', schedules)).toBe('workout'); // Mon, old schedule
    expect(scheduledDayType('2026-11-10', schedules)).toBe('rest'); // Tue, old schedule
    expect(scheduledDayType('2026-11-17', schedules)).toBe('workout'); // Tue, new schedule
    expect(scheduledDayType('2026-11-16', schedules)).toBe('rest'); // Mon, new schedule
  });
  it('lets an override win, and defaults to rest with no schedule', () => {
    expect(dayTypeFor('2026-11-16', schedules, 'workout')).toBe('workout');
    expect(dayTypeFor('2026-11-17', schedules, null)).toBe('workout');
    expect(scheduledDayType('2026-11-17', [])).toBe('rest');
  });
});

describe('targetFor', () => {
  const targets = [target('workout', '2026-11-01', 2800), target('workout', '2026-11-15', 2600), target('rest', '2026-11-01', 2200)];
  it('returns the target of that day type that applied on the day', () => {
    expect(targetFor('2026-11-14', 'workout', targets)?.kcal).toBe(2800);
    expect(targetFor('2026-11-15', 'workout', targets)?.kcal).toBe(2600);
    expect(targetFor('2026-11-15', 'rest', targets)?.kcal).toBe(2200);
  });
  it('is null when that day type has no target', () => {
    expect(targetFor('2026-11-15', 'rest', targets.filter((t) => t.dayType === 'workout'))).toBeNull();
  });
});

it('computes kcal from macros', () => {
  expect(kcalFromMacros({ proteinG: 180, carbsG: 300, fatG: 70 })).toBe(180 * 4 + 300 * 4 + 70 * 9);
});
