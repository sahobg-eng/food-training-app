import { beforeEach, describe, expect, it } from 'vitest';
import { useFreshDBForTests } from './schema';
import {
  addExercise,
  getExercise,
  listExercises,
  renameExercise,
  setExerciseArchived,
  setExerciseDetails,
  ValidationError,
} from './exercises';

beforeEach(() => useFreshDBForTests(`ex-${Math.random()}`));

describe('exercises', () => {
  it('adds with a cleaned name and lists sorted by name', async () => {
    await addExercise('  Squat ');
    await addExercise('bench   press');
    await addExercise('Deadlift');
    expect((await listExercises()).map((e) => e.name)).toEqual(['bench press', 'Deadlift', 'Squat']);
  });

  it('rejects empty, too long and duplicate names (case-insensitive)', async () => {
    await expect(addExercise('   ')).rejects.toBeInstanceOf(ValidationError);
    await expect(addExercise('x'.repeat(61))).rejects.toBeInstanceOf(ValidationError);
    await addExercise('Squat');
    await expect(addExercise('squat')).rejects.toThrow('already exists');
    expect(await listExercises()).toHaveLength(1);
  });

  it('renames, allowing a case change of its own name but not a clash', async () => {
    const a = await addExercise('Bench');
    await addExercise('Squat');
    expect((await renameExercise(a.id, 'BENCH')).name).toBe('BENCH');
    await expect(renameExercise(a.id, 'squat')).rejects.toThrow('already exists');
    expect((await getExercise(a.id))?.name).toBe('BENCH');
  });

  it('archives without deleting, and points duplicates at the archived one', async () => {
    const a = await addExercise('Dips');
    await setExerciseArchived(a.id, true);
    expect(await listExercises()).toHaveLength(0);
    expect(await listExercises({ includeArchived: true })).toHaveLength(1);
    await expect(addExercise('dips')).rejects.toThrow('Unarchive');
    await setExerciseArchived(a.id, false);
    expect((await listExercises()).map((e) => e.id)).toEqual([a.id]);
  });

  it('errors on a missing id', async () => {
    await expect(renameExercise('nope', 'X')).rejects.toThrow('no longer exists');
    await expect(setExerciseArchived('nope', true)).rejects.toThrow('no longer exists');
  });

  it('stores cleaned muscles and equipment, and lets them be changed', async () => {
    const a = await addExercise('Bench', {
      primaryMuscles: ['chest', 'chest'],
      secondaryMuscles: ['chest', 'triceps', 'wings' as never],
      equipment: ' barbell ',
      catalogId: 'Barbell_Bench',
    });
    expect(a).toMatchObject({ primaryMuscles: ['chest'], secondaryMuscles: ['triceps'], equipment: 'barbell', catalogId: 'Barbell_Bench' });
    const b = await addExercise('Plank');
    expect(b).toMatchObject({ primaryMuscles: [], secondaryMuscles: [], equipment: null });
    const u = await setExerciseDetails(b.id, { primaryMuscles: ['abdominals'] });
    expect(u).toMatchObject({ name: 'Plank', primaryMuscles: ['abdominals'], secondaryMuscles: [] });
  });
});
