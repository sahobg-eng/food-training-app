import type { DateStr, DayType, MacroTarget, ScheduleVersion } from '../db/types';
import { weekday } from './dates';

/**
 * The version in force on `date`: the latest with effectiveFrom <= date.
 * Days before the first version use the first version, so days logged after the fact
 * (before goals were set up) still get a target. Null when there are no versions.
 */
export function versionFor<T extends { effectiveFrom: DateStr }>(versions: T[], date: DateStr): T | null {
  let best: T | null = null;
  let earliest: T | null = null;
  for (const v of versions) {
    if (!earliest || v.effectiveFrom < earliest.effectiveFrom) earliest = v;
    if (v.effectiveFrom <= date && (!best || v.effectiveFrom > best.effectiveFrom)) best = v;
  }
  return best ?? earliest;
}

/** Day type from the weekly schedule alone. With no schedule, every day is a rest day. */
export function scheduledDayType(date: DateStr, schedules: ScheduleVersion[]): DayType {
  const s = versionFor(schedules, date);
  return s?.workoutWeekdays.includes(weekday(date)) ? 'workout' : 'rest';
}

/** Day type: the manual override for that date if there is one, else the schedule. */
export function dayTypeFor(date: DateStr, schedules: ScheduleVersion[], override?: DayType | null): DayType {
  return override ?? scheduledDayType(date, schedules);
}

/** The target that applied on `date` for that day type, or null if none was ever set. */
export function targetFor(date: DateStr, dayType: DayType, targets: MacroTarget[]): MacroTarget | null {
  return versionFor(
    targets.filter((t) => t.dayType === dayType),
    date,
  );
}

/** Calories implied by macros (4 kcal/g protein and carbs, 9 kcal/g fat). */
export function kcalFromMacros(m: { proteinG: number; carbsG: number; fatG: number }): number {
  return Math.round(m.proteinG * 4 + m.carbsG * 4 + m.fatG * 9);
}

export const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
