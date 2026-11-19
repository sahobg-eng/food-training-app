import { getDB } from './schema';
import { newId } from './id';
import type { DateStr, DayType, MacroTarget, ScheduleVersion } from './types';
import { ValidationError } from './validation';
import { toDateStr } from '../domain/dates';
import { dayTypeFor, scheduledDayType, targetFor, versionFor } from '../domain/macros';

export const MAX_KCAL = 10000;
export const MAX_MACRO_G = 1000;

export interface MacroValues {
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}

function parseAmount(raw: string | number, label: string, max: number, decimals: number): number {
  const text = typeof raw === 'number' ? String(raw) : raw.trim().replace(',', '.');
  const n = Number(text);
  if (!text || !Number.isFinite(n) || n < 0 || n > max) throw new ValidationError(`${label}: enter 0 to ${max}.`);
  const f = 10 ** decimals;
  return Math.round(n * f) / f;
}

/** Parse target inputs: whole kcal, grams to one decimal. */
export function parseMacroValues(input: Record<keyof MacroValues, string | number>): MacroValues {
  return {
    kcal: parseAmount(input.kcal, 'Calories', MAX_KCAL, 0),
    proteinG: parseAmount(input.proteinG, 'Protein', MAX_MACRO_G, 1),
    carbsG: parseAmount(input.carbsG, 'Carbs', MAX_MACRO_G, 1),
    fatG: parseAmount(input.fatG, 'Fat', MAX_MACRO_G, 1),
  };
}

export interface MacroSettings {
  targets: MacroTarget[];
  schedules: ScheduleVersion[];
}

export async function getMacroSettings(): Promise<MacroSettings> {
  const db = await getDB();
  const [targets, schedules] = await Promise.all([db.getAll('macroTargets'), db.getAll('scheduleVersions')]);
  return { targets, schedules };
}

const sameValues = (a: MacroValues, b: MacroValues) =>
  a.kcal === b.kcal && a.proteinG === b.proteinG && a.carbsG === b.carbsG && a.fatG === b.fatG;

/**
 * Change a target from `today` on. Past days keep the version that applied to them:
 * this writes a new version effective today, or updates today's version if one exists.
 */
export async function setTarget(
  dayType: DayType,
  input: Record<keyof MacroValues, string | number>,
  today = toDateStr(),
): Promise<MacroTarget> {
  const values = parseMacroValues(input);
  const tx = (await getDB()).transaction('macroTargets', 'readwrite');
  const all = (await tx.store.getAll()).filter((t) => t.dayType === dayType);
  const current = targetFor(today, dayType, all);
  if (current && sameValues(current, values)) {
    await tx.done;
    return current;
  }
  const todays = all.find((t) => t.effectiveFrom === today);
  const target: MacroTarget = { ...(todays ?? { id: newId(), dayType, effectiveFrom: today }), ...values };
  await tx.store.put(target);
  await tx.done;
  return target;
}

/** Change the weekly schedule from `today` on (same versioning as targets). Weekdays: Mon = 0. */
export async function setSchedule(workoutWeekdays: number[], today = toDateStr()): Promise<ScheduleVersion> {
  const days = [...new Set(workoutWeekdays)].sort();
  if (days.some((d) => !Number.isInteger(d) || d < 0 || d > 6)) throw new ValidationError('Invalid weekday.');
  const tx = (await getDB()).transaction('scheduleVersions', 'readwrite');
  const all = await tx.store.getAll();
  const current = versionFor(all, today);
  if (current && current.workoutWeekdays.join() === days.join()) {
    await tx.done;
    return current;
  }
  const todays = all.find((s) => s.effectiveFrom === today);
  const version: ScheduleVersion = { ...(todays ?? { id: newId(), effectiveFrom: today }), workoutWeekdays: days };
  await tx.store.put(version);
  await tx.done;
  return version;
}

/**
 * Switch one day to a workout or rest day. Setting it back to what the schedule says
 * (or passing null) removes the override.
 */
export async function setDayType(date: DateStr, dayType: DayType | null): Promise<void> {
  const tx = (await getDB()).transaction(['dayOverrides', 'scheduleVersions'], 'readwrite');
  const scheduled = scheduledDayType(date, await tx.objectStore('scheduleVersions').getAll());
  if (dayType === null || dayType === scheduled) await tx.objectStore('dayOverrides').delete(date);
  else await tx.objectStore('dayOverrides').put({ date, dayType });
  await tx.done;
}

export interface DayPlan {
  date: DateStr;
  dayType: DayType;
  scheduledType: DayType;
  isOverride: boolean;
  target: MacroTarget | null;
}

/** Everything about a day's goal: its type (and why) and the target that applied. */
export async function getDayPlan(date: DateStr): Promise<DayPlan> {
  const db = await getDB();
  const [{ targets, schedules }, override] = await Promise.all([getMacroSettings(), db.get('dayOverrides', date)]);
  const dayType = dayTypeFor(date, schedules, override?.dayType);
  return {
    date,
    dayType,
    scheduledType: scheduledDayType(date, schedules),
    isOverride: !!override,
    target: targetFor(date, dayType, targets),
  };
}
