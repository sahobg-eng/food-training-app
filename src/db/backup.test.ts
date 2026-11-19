import { beforeEach, describe, expect, it } from 'vitest';
import { getDB, SCHEMA_VERSION, STORE_NAMES, useFreshDBForTests } from './schema';
import { addExercise, listExercises } from './exercises';
import { createRoutine } from './routines';
import { addSet, addSlot, finishWorkout, getWorkoutSets, listFinishedWorkouts, startWorkout } from './workouts';
import {
  backupFileName,
  buildBackup,
  countCurrentRows,
  getLastExportAt,
  parseBackup,
  recordExport,
  restoreBackup,
  serializeBackup,
} from './backup';

beforeEach(() => useFreshDBForTests(`bk-${Math.random()}`));

async function seedTraining() {
  const bench = await addExercise('Bench');
  await addExercise('Squat');
  await createRoutine('Push', [bench.id]);
  const w = await startWorkout(null, new Date(2026, 10, 19, 18).getTime());
  const { exercises } = await addSlot(w.id, bench.id);
  await addSet(w.id, exercises[0].id, { reps: 5, weightKg: 100 });
  await addSet(w.id, exercises[0].id, { reps: 5, weightKg: 102.5 });
  await finishWorkout(w.id, new Date(2026, 10, 19, 19).getTime());
  return w.id;
}

describe('backup', () => {
  it('names the file by local date', () => {
    expect(backupFileName(new Date(2026, 10, 19, 23, 59).getTime())).toBe('food-training-backup-2026-11-19.json');
  });

  it('round-trips all data into an empty database', async () => {
    const workoutId = await seedTraining();
    const text = serializeBackup(await buildBackup(1234));
    const before = await countCurrentRows();

    await useFreshDBForTests(`bk-restore-${Math.random()}`);
    await restoreBackup(parseBackup(text));

    const { meta: _m1, ...after } = await countCurrentRows();
    const { meta: _m2, ...expected } = before;
    expect(after).toEqual(expected); // meta also gains lastExportAt
    expect((await listExercises()).map((e) => e.name)).toEqual(['Bench', 'Squat']);
    expect((await listFinishedWorkouts()).map((x) => x.setCount)).toEqual([2]);
    expect((await getWorkoutSets(workoutId)).map((s) => s.weightKg)).toEqual([100, 102.5]);
    expect(await getLastExportAt()).toBe(1234);
  });

  it('replaces existing data instead of merging', async () => {
    await seedTraining();
    const text = serializeBackup(await buildBackup());
    await addExercise('Deadlift'); // made after the backup
    await restoreBackup(parseBackup(text));
    expect((await listExercises()).map((e) => e.name)).toEqual(['Bench', 'Squat']);
  });

  it('records the last export time', async () => {
    expect(await getLastExportAt()).toBeNull();
    await recordExport(999);
    expect(await getLastExportAt()).toBe(999);
  });

  it('rejects files that are not valid backups', async () => {
    const good = JSON.parse(serializeBackup(await buildBackup()));
    const bad = (patch: object) => JSON.stringify({ ...good, ...patch });
    expect(() => parseBackup('not json')).toThrow('not valid JSON');
    expect(() => parseBackup(bad({ app: 'other' }))).toThrow('not a Food & Training backup');
    expect(() => parseBackup(bad({ schemaVersion: SCHEMA_VERSION + 1 }))).toThrow('newer version');
    expect(() => parseBackup(bad({ schemaVersion: 'x' }))).toThrow('version');
    expect(() => parseBackup(bad({ stores: { ...good.stores, hacked: [] } }))).toThrow('Unknown data');
    expect(() => parseBackup(bad({ stores: { ...good.stores, exercises: {} } }))).toThrow('not a list');
    expect(() => parseBackup(bad({ stores: { ...good.stores, exercises: [{ name: 'x' }] } }))).toThrow('has no id');
    expect(() => parseBackup(bad({ stores: { ...good.stores, exercises: [{ id: 'a' }, { id: 'a' }] } }))).toThrow('duplicate');
  });

  it('fills in stores missing from an older backup', async () => {
    const good = JSON.parse(serializeBackup(await buildBackup()));
    delete good.stores.foodEntries;
    const b = parseBackup(JSON.stringify(good));
    expect(b.stores.foodEntries).toEqual([]);
    expect(Object.keys(b.stores).sort()).toEqual([...STORE_NAMES].sort());
  });

  it('leaves data untouched when a restore fails part-way', async () => {
    await seedTraining();
    const backup = await buildBackup();
    // Bypass parseBackup to force a database-level failure (bad key) mid-transaction.
    backup.stores.sets = [...backup.stores.sets, { id: { not: 'a valid key' } }];
    await expect(restoreBackup(backup)).rejects.toThrow('not changed');
    expect((await listExercises()).map((e) => e.name)).toEqual(['Bench', 'Squat']);
    expect(await (await getDB()).count('sets')).toBe(2);
  });
});
