import { describe, expect, it } from 'vitest';
import { openAppDB, SCHEMA_VERSION, STORE_NAMES } from './schema';
import type { Workout, WorkoutSet } from './types';

let n = 0;
const freshName = () => `test-db-${++n}-${Math.random()}`;

describe('schema', () => {
  it('creates every store', async () => {
    const db = await openAppDB(freshName());
    expect([...db.objectStoreNames].sort()).toEqual([...STORE_NAMES].sort());
    db.close();
  });

  it('seeds body weight and meta once', async () => {
    const name = freshName();
    let db = await openAppDB(name);
    const types = await db.getAll('measurementTypes');
    expect(types).toHaveLength(1);
    expect(types[0]).toMatchObject({ name: 'Body weight', unit: 'kg', isDefault: true, archived: false });
    expect((await db.get('meta', 'schemaVersion'))?.value).toBe(SCHEMA_VERSION);
    expect(typeof (await db.get('meta', 'seededAt'))?.value).toBe('number');
    db.close();

    db = await openAppDB(name);
    expect(await db.count('measurementTypes')).toBe(1);
    db.close();
  });

  it('finds the latest previous sets for an exercise via [exerciseId, date]', async () => {
    const db = await openAppDB(freshName());
    const set = (id: string, exerciseId: string, date: string, order: number): WorkoutSet => ({
      id, workoutId: 'w-' + date, workoutExerciseId: 's', exerciseId, date, order, reps: 5, weightKg: 100, createdAt: 0,
    });
    for (const s of [
      set('a', 'bench', '2026-11-01', 0),
      set('b', 'bench', '2026-11-10', 0),
      set('c', 'bench', '2026-11-10', 1),
      set('d', 'squat', '2026-11-12', 0),
      set('e', 'bench', '2026-11-19', 0), // "today"
    ]) await db.add('sets', s);

    // Latest bench date strictly before today.
    const range = IDBKeyRange.bound(['bench', ''], ['bench', '2026-11-19'], false, true);
    const cursor = await db.transaction('sets').store.index('exerciseId_date').openCursor(range, 'prev');
    expect(cursor?.value.date).toBe('2026-11-10');
    db.close();
  });

  it('leaves in-progress workouts out of the endedAt index', async () => {
    const db = await openAppDB(freshName());
    const w = (id: string, endedAt: number | null): Workout => ({
      id, date: '2026-11-19', startedAt: 1, endedAt, durationSec: null, routineId: null, routineName: null, exercises: [],
    });
    await db.add('workouts', w('done', 100));
    await db.add('workouts', w('live', null));
    expect((await db.getAllFromIndex('workouts', 'endedAt')).map((x) => x.id)).toEqual(['done']);
    expect(await db.count('workouts')).toBe(2);
    db.close();
  });

  it('keys day overrides by date', async () => {
    const db = await openAppDB(freshName());
    await db.put('dayOverrides', { date: '2026-11-19', dayType: 'rest' });
    await db.put('dayOverrides', { date: '2026-11-19', dayType: 'workout' });
    expect(await db.get('dayOverrides', '2026-11-19')).toEqual({ date: '2026-11-19', dayType: 'workout' });
    db.close();
  });
});
