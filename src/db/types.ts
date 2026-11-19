// Record shapes for every IndexedDB store. See "Data model" in CLAUDE.md.
// Conventions: ids are UUID strings; `date` is a local calendar day 'YYYY-MM-DD';
// fields ending in `At` are epoch milliseconds.

export type DateStr = string; // 'YYYY-MM-DD', local calendar day
export type DayType = 'workout' | 'rest';

// ---------- Training ----------

export interface Exercise {
  id: string;
  name: string;
  archived: boolean;
  createdAt: number;
}

export interface Routine {
  id: string;
  name: string;
  exerciseIds: string[]; // ordered
  createdAt: number;
  updatedAt: number;
}

/** One exercise slot inside a workout. Owned by the workout, not the routine. */
export interface WorkoutExerciseSlot {
  id: string;
  exerciseId: string;
  order: number;
}

export interface Workout {
  id: string;
  date: DateStr;
  startedAt: number;
  endedAt: number | null; // null = in progress
  durationSec: number | null;
  routineId: string | null; // null = free workout
  routineName: string | null; // snapshot at start
  exercises: WorkoutExerciseSlot[];
}

export interface WorkoutSet {
  id: string;
  workoutId: string;
  workoutExerciseId: string; // WorkoutExerciseSlot.id
  exerciseId: string;
  date: DateStr; // copied from the workout
  order: number;
  reps: number;
  weightKg: number;
  createdAt: number;
}

// ---------- Body measurements ----------

export type MeasurementUnit = 'kg' | 'cm';

export interface MeasurementType {
  id: string;
  name: string;
  unit: MeasurementUnit;
  archived: boolean;
  isDefault: boolean;
  createdAt: number;
}

export interface MeasurementEntry {
  id: string;
  typeId: string;
  date: DateStr;
  value: number;
  createdAt: number;
}

// ---------- Macro goals ----------

export interface MacroTarget {
  id: string;
  dayType: DayType;
  effectiveFrom: DateStr;
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}

export interface ScheduleVersion {
  id: string;
  effectiveFrom: DateStr;
  workoutWeekdays: number[]; // 0 = Monday ... 6 = Sunday
}

export interface DayOverride {
  date: DateStr; // primary key
  dayType: DayType;
}

// ---------- Food ----------

export type FoodBasis = 'per100g' | 'perServing';

export interface Food {
  id: string;
  name: string;
  basis: FoodBasis;
  servingLabel: string | null; // e.g. "1 bar"; only for perServing
  kcal: number; // per basis unit
  proteinG: number;
  carbsG: number;
  fatG: number;
  favourite: boolean;
  archived: boolean;
  lastUsedAt: number | null;
  createdAt: number;
}

export interface FoodEntry {
  id: string;
  date: DateStr;
  foodId: string | null;
  name: string; // snapshot
  amount: number;
  amountUnit: 'g' | 'serving';
  kcal: number; // totals for this entry, snapshot
  proteinG: number;
  carbsG: number;
  fatG: number;
  loggedAt: number;
}

// ---------- App ----------

export interface MetaValues {
  schemaVersion: number;
  seededAt: number;
  lastExportAt: number;
}

export type MetaKey = keyof MetaValues;

export interface MetaRecord<K extends MetaKey = MetaKey> {
  key: K;
  value: MetaValues[K];
}
