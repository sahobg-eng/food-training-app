import { beforeEach, describe, expect, it } from 'vitest';
import { useFreshDBForTests } from './schema';
import { addExercise } from './exercises';
import {
  addSet,
  addSlot,
  finishWorkout,
  getWorkout,
  getWorkoutSets,
  finishedWorkoutsByDate,
  listFinishedWorkouts,
  startWorkout,
  updateWorkoutTimes,
} from './workouts';
import { atLocalTime } from '../domain/dates';

beforeEach(() => useFreshDBForTests(`hist-${Math.random()}`));

const H = 3600_000;

async function done(start: number, sets = 0) {
  const ex = await addExercise(`Ex ${start}`);
  const w = await startWorkout(null, start);
  const { exercises } = await addSlot(w.id, ex.id);
  for (let i = 0; i < sets; i++) await addSet(w.id, exercises[0].id, { reps: 5, weightKg: 50 });
  return finishWorkout(w.id, start + H);
}

describe('history', () => {
  it('lists finished workouts newest first with set counts, excluding the active one', async () => {
    const a = await done(atLocalTime('2026-11-10', '18:00'), 3);
    const b = await done(atLocalTime('2026-11-17', '07:30'), 0);
    const c = await done(atLocalTime('2026-11-14', '12:00'), 5);
    await startWorkout(null);
    const list = await listFinishedWorkouts();
    expect(list.map((x) => [x.workout.id, x.setCount])).toEqual([[b.id, 0], [c.id, 5], [a.id, 3]]);
  });

  it('corrects times, recomputes duration and moves sets to the new date', async () => {
    const w = await done(atLocalTime('2026-11-19', '18:00'), 2);
    const u = await updateWorkoutTimes(w.id, atLocalTime('2026-11-18', '17:45'), atLocalTime('2026-11-18', '19:00'));
    expect(u).toMatchObject({ date: '2026-11-18', durationSec: 75 * 60 });
    expect((await getWorkoutSets(w.id)).map((s) => s.date)).toEqual(['2026-11-18', '2026-11-18']);
    expect((await getWorkout(w.id))?.date).toBe('2026-11-18');
  });

  it('rejects end before start, over 24 h, and active workouts', async () => {
    const w = await done(atLocalTime('2026-11-19', '18:00'));
    const t = atLocalTime('2026-11-19', '18:00');
    await expect(updateWorkoutTimes(w.id, t, t)).rejects.toThrow('after the start');
    await expect(updateWorkoutTimes(w.id, t, t + 25 * H)).rejects.toThrow('24 hours');
    const active = await startWorkout(null);
    await expect(updateWorkoutTimes(active.id, t, t + H)).rejects.toThrow('Finish the workout');
  });
});

describe('workouts by date', () => {
  it('groups finished workouts in a range by day, oldest first, skipping the active one', async () => {
    const a = await done(atLocalTime('2026-11-03', '18:00'));
    const b = await done(atLocalTime('2026-11-17', '07:00'));
    const c = await done(atLocalTime('2026-11-17', '19:00'));
    await done(atLocalTime('2026-10-31', '10:00'));
    await done(atLocalTime('2026-12-01', '10:00'));
    await startWorkout(null, atLocalTime('2026-11-20', '09:00'));
    const byDate = await finishedWorkoutsByDate('2026-11-01', '2026-11-30');
    expect([...byDate.keys()].sort()).toEqual(['2026-11-03', '2026-11-17']);
    expect(byDate.get('2026-11-17')!.map((w) => w.id)).toEqual([b.id, c.id]);
    expect(byDate.get('2026-11-03')!.map((w) => w.id)).toEqual([a.id]);
  });
});
