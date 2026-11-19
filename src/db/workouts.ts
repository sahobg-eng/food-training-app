import { getDB } from './schema';
import { newId } from './id';
import type { DateStr, Workout, WorkoutExerciseSlot, WorkoutSet } from './types';
import { ValidationError } from './validation';
import { toDateStr } from '../domain/dates';

export const MAX_REPS = 999;
export const MAX_WEIGHT_KG = 1000;

// ---------- Input parsing ----------

/** Parse a weight typed on a phone keyboard ("102,5" or "102.5"). 0 = bodyweight. */
export function parseWeightKg(raw: string | number): number {
  const n = typeof raw === 'number' ? raw : Number(raw.trim().replace(',', '.'));
  if (!Number.isFinite(n) || (typeof raw === 'string' && !raw.trim())) throw new ValidationError('Enter a weight in kg (0 for bodyweight).');
  if (n < 0 || n > MAX_WEIGHT_KG) throw new ValidationError(`Weight must be between 0 and ${MAX_WEIGHT_KG} kg.`);
  return Math.round(n * 100) / 100;
}

export function parseReps(raw: string | number): number {
  const n = typeof raw === 'number' ? raw : Number(raw.trim());
  if (!Number.isInteger(n) || n < 1 || n > MAX_REPS || (typeof raw === 'string' && !raw.trim()))
    throw new ValidationError(`Reps must be a whole number from 1 to ${MAX_REPS}.`);
  return n;
}

// ---------- Workouts ----------

export async function getWorkout(id: string): Promise<Workout | undefined> {
  return (await getDB()).get('workouts', id);
}

/** The unfinished workout, if any. There is at most one. */
export async function getActiveWorkout(): Promise<Workout | undefined> {
  const all = await (await getDB()).getAll('workouts');
  return all.filter((w) => w.endedAt === null).sort((a, b) => b.startedAt - a.startedAt)[0];
}

/**
 * Start a workout from a routine (its active exercises, in order) or empty.
 * Fails if a workout is already in progress.
 */
export async function startWorkout(routineId: string | null, now = Date.now()): Promise<Workout> {
  const db = await getDB();
  const tx = db.transaction(['workouts', 'routines', 'exercises'], 'readwrite');
  const all = await tx.objectStore('workouts').getAll();
  if (all.some((w) => w.endedAt === null))
    throw new ValidationError('A workout is already in progress. Finish or discard it first.');

  let routineName: string | null = null;
  const exerciseIds: string[] = [];
  if (routineId) {
    const routine = await tx.objectStore('routines').get(routineId);
    if (!routine) throw new ValidationError('That routine no longer exists.');
    routineName = routine.name;
    for (const exId of routine.exerciseIds) {
      const ex = await tx.objectStore('exercises').get(exId);
      if (ex && !ex.archived) exerciseIds.push(exId);
    }
  }

  const workout: Workout = {
    id: newId(),
    date: toDateStr(now),
    startedAt: now,
    endedAt: null,
    durationSec: null,
    routineId,
    routineName,
    exercises: exerciseIds.map((exerciseId, order) => ({ id: newId(), exerciseId, order })),
  };
  await tx.objectStore('workouts').add(workout);
  await tx.done;
  return workout;
}

export async function finishWorkout(id: string, now = Date.now()): Promise<Workout> {
  const tx = (await getDB()).transaction('workouts', 'readwrite');
  const w = await tx.store.get(id);
  if (!w) throw new ValidationError('That workout no longer exists.');
  if (w.endedAt !== null) return w;
  const endedAt = Math.max(now, w.startedAt);
  const updated: Workout = { ...w, endedAt, durationSec: Math.round((endedAt - w.startedAt) / 1000) };
  await tx.store.put(updated);
  await tx.done;
  return updated;
}

/** Delete a workout and all its sets. */
export async function deleteWorkout(id: string): Promise<void> {
  const tx = (await getDB()).transaction(['workouts', 'sets'], 'readwrite');
  const sets = tx.objectStore('sets');
  for (const key of await sets.index('workoutId').getAllKeys(id)) await sets.delete(key);
  await tx.objectStore('workouts').delete(id);
  await tx.done;
}

// ---------- Exercise slots (the session's own list; never touches the routine) ----------

async function editSlots(
  workoutId: string,
  fn: (slots: WorkoutExerciseSlot[], w: Workout) => WorkoutExerciseSlot[],
): Promise<Workout> {
  const tx = (await getDB()).transaction('workouts', 'readwrite');
  const w = await tx.store.get(workoutId);
  if (!w) throw new ValidationError('That workout no longer exists.');
  const slots = fn([...w.exercises].sort((a, b) => a.order - b.order), w).map((s, order) => ({ ...s, order }));
  const updated = { ...w, exercises: slots };
  await tx.store.put(updated);
  await tx.done;
  return updated;
}

export function addSlot(workoutId: string, exerciseId: string): Promise<Workout> {
  return editSlots(workoutId, (slots) => {
    if (slots.some((s) => s.exerciseId === exerciseId))
      throw new ValidationError('That exercise is already in this workout.');
    return [...slots, { id: newId(), exerciseId, order: slots.length }];
  });
}

/** Remove an exercise from the workout, with its sets. */
export async function removeSlot(workoutId: string, slotId: string): Promise<Workout> {
  const tx = (await getDB()).transaction(['workouts', 'sets'], 'readwrite');
  const w = await tx.objectStore('workouts').get(workoutId);
  if (!w) throw new ValidationError('That workout no longer exists.');
  const sets = tx.objectStore('sets');
  for (const s of await sets.index('workoutId').getAll(workoutId))
    if (s.workoutExerciseId === slotId) await sets.delete(s.id);
  const updated = {
    ...w,
    exercises: w.exercises
      .filter((s) => s.id !== slotId)
      .sort((a, b) => a.order - b.order)
      .map((s, order) => ({ ...s, order })),
  };
  await tx.objectStore('workouts').put(updated);
  await tx.done;
  return updated;
}

/** Swap the exercise in a slot; its logged sets move to the new exercise. */
export async function swapSlot(workoutId: string, slotId: string, exerciseId: string): Promise<Workout> {
  const tx = (await getDB()).transaction(['workouts', 'sets'], 'readwrite');
  const w = await tx.objectStore('workouts').get(workoutId);
  if (!w) throw new ValidationError('That workout no longer exists.');
  if (w.exercises.some((s) => s.exerciseId === exerciseId && s.id !== slotId))
    throw new ValidationError('That exercise is already in this workout.');
  const sets = tx.objectStore('sets');
  for (const s of await sets.index('workoutId').getAll(workoutId))
    if (s.workoutExerciseId === slotId) await sets.put({ ...s, exerciseId });
  const updated = { ...w, exercises: w.exercises.map((s) => (s.id === slotId ? { ...s, exerciseId } : s)) };
  await tx.objectStore('workouts').put(updated);
  await tx.done;
  return updated;
}

// ---------- Sets ----------

/** All sets of a workout, grouped in slot order then set order. */
export async function getWorkoutSets(workoutId: string): Promise<WorkoutSet[]> {
  const sets = await (await getDB()).getAllFromIndex('sets', 'workoutId', workoutId);
  return sets.sort((a, b) => a.order - b.order || a.createdAt - b.createdAt);
}

export async function addSet(
  workoutId: string,
  slotId: string,
  input: { reps: string | number; weightKg: string | number },
): Promise<WorkoutSet> {
  const reps = parseReps(input.reps);
  const weightKg = parseWeightKg(input.weightKg);
  const tx = (await getDB()).transaction(['workouts', 'sets'], 'readwrite');
  const w = await tx.objectStore('workouts').get(workoutId);
  const slot = w?.exercises.find((s) => s.id === slotId);
  if (!w || !slot) throw new ValidationError('That exercise is no longer in this workout.');
  const existing = (await tx.objectStore('sets').index('workoutId').getAll(workoutId)).filter(
    (s) => s.workoutExerciseId === slotId,
  );
  const set: WorkoutSet = {
    id: newId(),
    workoutId,
    workoutExerciseId: slotId,
    exerciseId: slot.exerciseId,
    date: w.date,
    order: existing.reduce((m, s) => Math.max(m, s.order + 1), 0),
    reps,
    weightKg,
    createdAt: Date.now(),
  };
  await tx.objectStore('sets').add(set);
  await tx.done;
  return set;
}

export async function updateSet(
  id: string,
  input: { reps: string | number; weightKg: string | number },
): Promise<WorkoutSet> {
  const reps = parseReps(input.reps);
  const weightKg = parseWeightKg(input.weightKg);
  const tx = (await getDB()).transaction('sets', 'readwrite');
  const s = await tx.store.get(id);
  if (!s) throw new ValidationError('That set no longer exists.');
  const updated = { ...s, reps, weightKg };
  await tx.store.put(updated);
  await tx.done;
  return updated;
}

export async function deleteSet(id: string): Promise<void> {
  await (await getDB()).delete('sets', id);
}

// ---------- Previous values ----------

export interface PreviousPerformance {
  workoutId: string;
  date: DateStr;
  sets: WorkoutSet[];
}

/**
 * Sets from the last time this exercise was done: the most recent *finished* workout
 * that started before `before` (another workout) and contains the exercise.
 */
export async function getPreviousSets(
  exerciseId: string,
  before: Pick<Workout, 'id' | 'date' | 'startedAt'>,
): Promise<PreviousPerformance | null> {
  const db = await getDB();
  const tx = db.transaction(['sets', 'workouts']);
  const workouts = tx.objectStore('workouts');
  const cache = new Map<string, Workout | undefined>();
  const range = IDBKeyRange.bound([exerciseId, ''], [exerciseId, before.date]);

  let best: Workout | undefined;
  let cursor = await tx.objectStore('sets').index('exerciseId_date').openCursor(range, 'prev');
  while (cursor) {
    const s = cursor.value;
    // Dates are visited newest first; once a match is found, only that same day can beat it.
    if (best && s.date < best.date) break;
    if (s.workoutId !== before.id) {
      if (!cache.has(s.workoutId)) cache.set(s.workoutId, await workouts.get(s.workoutId));
      const w = cache.get(s.workoutId);
      if (w && w.endedAt !== null && w.startedAt < before.startedAt && (!best || w.startedAt > best.startedAt))
        best = w;
    }
    cursor = await cursor.continue();
  }
  if (!best) return null;

  const sets = (await tx.objectStore('sets').index('workoutId').getAll(best.id))
    .filter((s) => s.exerciseId === exerciseId)
    .sort((a, b) => a.order - b.order);
  return { workoutId: best.id, date: best.date, sets };
}
