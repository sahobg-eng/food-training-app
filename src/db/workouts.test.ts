import { beforeEach, describe, expect, it } from 'vitest';
import { useFreshDBForTests } from './schema';
import { addExercise, setExerciseArchived } from './exercises';
import { createRoutine, getRoutine } from './routines';
import {
  addSet,
  addSlot,
  deleteSet,
  deleteWorkout,
  finishWorkout,
  getActiveWorkout,
  getPreviousSets,
  getWorkout,
  getWorkoutSets,
  parseReps,
  parseWeightKg,
  removeSlot,
  startWorkout,
  swapSlot,
  updateSet,
} from './workouts';

beforeEach(() => useFreshDBForTests(`wo-${Math.random()}`));

const day = (d: string, h = 10) => new Date(`${d}T${String(h).padStart(2, '0')}:00:00`).getTime();

describe('input parsing', () => {
  it('accepts comma decimals and bodyweight, rejects nonsense', () => {
    expect(parseWeightKg('102,5')).toBe(102.5);
    expect(parseWeightKg(' 80 ')).toBe(80);
    expect(parseWeightKg('0')).toBe(0);
    expect(parseWeightKg('12.3456')).toBe(12.35);
    for (const bad of ['', 'abc', '-5', '1001']) expect(() => parseWeightKg(bad)).toThrow();
    expect(parseReps('8')).toBe(8);
    for (const bad of ['', '0', '2.5', '1000', 'x']) expect(() => parseReps(bad)).toThrow();
  });
});

describe('workouts', () => {
  it('starts from a routine, skipping archived exercises, and allows only one active', async () => {
    const a = await addExercise('Bench');
    const b = await addExercise('Dips');
    const c = await addExercise('OHP');
    await setExerciseArchived(b.id, true);
    const r = await createRoutine('Push', [c.id, b.id, a.id]);

    const w = await startWorkout(r.id, day('2026-11-19'));
    expect(w).toMatchObject({ date: '2026-11-19', routineName: 'Push', endedAt: null });
    expect(w.exercises.map((s) => [s.exerciseId, s.order])).toEqual([[c.id, 0], [a.id, 1]]);
    expect((await getActiveWorkout())?.id).toBe(w.id);
    await expect(startWorkout(null)).rejects.toThrow('already in progress');
  });

  it('finishes with end time and duration, then a new one can start', async () => {
    const w = await startWorkout(null, day('2026-11-19', 10));
    const done = await finishWorkout(w.id, day('2026-11-19', 10) + 61 * 60_000 + 30_000);
    expect(done.durationSec).toBe(61 * 60 + 30);
    expect(await getActiveWorkout()).toBeUndefined();
    await expect(startWorkout(null)).resolves.toBeTruthy();
  });

  it('edits the session list without touching the routine', async () => {
    const a = await addExercise('Bench');
    const b = await addExercise('Dips');
    const c = await addExercise('Flyes');
    const r = await createRoutine('Push', [a.id, b.id]);
    const w = await startWorkout(r.id);
    const [slotA, slotB] = w.exercises;

    await addSet(w.id, slotB.id, { reps: 10, weightKg: 0 });
    let u = await swapSlot(w.id, slotB.id, c.id);
    expect(u.exercises[1].exerciseId).toBe(c.id);
    expect((await getWorkoutSets(w.id))[0].exerciseId).toBe(c.id);
    await expect(addSlot(w.id, a.id)).rejects.toThrow('already in this workout');
    await expect(swapSlot(w.id, slotB.id, a.id)).rejects.toThrow('already in this workout');

    await addSet(w.id, slotA.id, { reps: 5, weightKg: 100 });
    u = await removeSlot(w.id, slotA.id);
    expect(u.exercises.map((s) => [s.exerciseId, s.order])).toEqual([[c.id, 0]]);
    expect((await getWorkoutSets(w.id)).map((s) => s.exerciseId)).toEqual([c.id]);

    u = await addSlot(w.id, b.id);
    expect(u.exercises.map((s) => s.exerciseId)).toEqual([c.id, b.id]);
    expect((await getRoutine(r.id))?.exerciseIds).toEqual([a.id, b.id]);
  });

  it('adds, edits and deletes sets with increasing order and copied date', async () => {
    const a = await addExercise('Bench');
    const w = await startWorkout(null, day('2026-11-19'));
    const { exercises } = await addSlot(w.id, a.id);
    const slot = exercises[0].id;
    const s1 = await addSet(w.id, slot, { reps: '5', weightKg: '100' });
    const s2 = await addSet(w.id, slot, { reps: '5', weightKg: '102,5' });
    expect([s1.order, s2.order]).toEqual([0, 1]);
    expect(s2).toMatchObject({ date: '2026-11-19', exerciseId: a.id, weightKg: 102.5 });
    await updateSet(s1.id, { reps: 6, weightKg: 100 });
    await deleteSet(s2.id);
    const s3 = await addSet(w.id, slot, { reps: 4, weightKg: 105 });
    expect(s3.order).toBe(1);
    expect((await getWorkoutSets(w.id)).map((s) => [s.reps, s.weightKg])).toEqual([[6, 100], [4, 105]]);
    await expect(addSet(w.id, slot, { reps: 0, weightKg: 100 })).rejects.toThrow();
  });

  it('deletes a workout with its sets', async () => {
    const a = await addExercise('Bench');
    const w = await startWorkout(null);
    const { exercises } = await addSlot(w.id, a.id);
    await addSet(w.id, exercises[0].id, { reps: 5, weightKg: 50 });
    await deleteWorkout(w.id);
    expect(await getWorkout(w.id)).toBeUndefined();
    expect(await getWorkoutSets(w.id)).toEqual([]);
  });
});

describe('previous values', () => {
  async function session(exId: string, start: number, sets: [number, number][], finish = true) {
    const w = await startWorkout(null, start);
    const { exercises } = await addSlot(w.id, exId);
    for (const [reps, weightKg] of sets) await addSet(w.id, exercises[0].id, { reps, weightKg });
    return finish ? finishWorkout(w.id, start + 3600_000) : w;
  }

  it('returns the latest earlier finished session, in set order', async () => {
    const a = await addExercise('Bench');
    const other = await addExercise('Squat');
    await session(a.id, day('2026-11-10'), [[5, 90]]);
    await session(a.id, day('2026-11-14'), [[5, 100], [5, 100], [4, 100]]);
    await session(other.id, day('2026-11-16'), [[5, 140]]);
    const today = await session(a.id, day('2026-11-19'), [[5, 102.5]], false);

    const prev = await getPreviousSets(a.id, today);
    expect(prev?.date).toBe('2026-11-14');
    expect(prev?.sets.map((s) => [s.reps, s.weightKg])).toEqual([[5, 100], [5, 100], [4, 100]]);
    expect(await getPreviousSets(other.id, today)).toMatchObject({ date: '2026-11-16' });
  });

  it('picks the later of two workouts on the same day, and ignores later workouts', async () => {
    const a = await addExercise('Bench');
    await session(a.id, day('2026-11-19', 7), [[5, 80]]);
    await session(a.id, day('2026-11-19', 12), [[5, 85]]);
    const evening = await session(a.id, day('2026-11-19', 18), [[5, 90]]);
    await session(a.id, day('2026-11-20', 9), [[5, 95]]);

    const prev = await getPreviousSets(a.id, evening);
    expect(prev?.sets.map((s) => s.weightKg)).toEqual([85]);
  });

  it('returns null the first time', async () => {
    const a = await addExercise('Bench');
    const w = await session(a.id, day('2026-11-19'), [[5, 80]], false);
    expect(await getPreviousSets(a.id, w)).toBeNull();
  });
});
