import { beforeEach, describe, expect, it } from 'vitest';
import { useFreshDBForTests } from './schema';
import {
  copyName,
  createRoutine,
  deleteRoutine,
  duplicateRoutine,
  getRoutine,
  listRoutines,
  moveItem,
  updateRoutine,
} from './routines';

beforeEach(() => useFreshDBForTests(`rt-${Math.random()}`));

describe('routines', () => {
  it('creates, lists by name and rejects duplicate names', async () => {
    await createRoutine('Push day', ['bench', 'ohp']);
    await createRoutine(' leg  day ');
    expect((await listRoutines()).map((r) => r.name)).toEqual(['leg day', 'Push day']);
    await expect(createRoutine('PUSH DAY')).rejects.toThrow('already exists');
  });

  it('keeps exercise order and drops repeats', async () => {
    const r = await createRoutine('Pull', ['row', 'curl', 'row']);
    expect(r.exerciseIds).toEqual(['row', 'curl']);
  });

  it('updates name and exercises and bumps updatedAt', async () => {
    const r = await createRoutine('Pull', ['row']);
    await new Promise((res) => setTimeout(res, 2));
    const u = await updateRoutine(r.id, { exerciseIds: ['curl', 'row'] });
    expect(u.exerciseIds).toEqual(['curl', 'row']);
    expect(u.updatedAt).toBeGreaterThan(r.updatedAt);
    expect((await updateRoutine(r.id, { name: 'Back' })).name).toBe('Back');
    await createRoutine('Legs');
    await expect(updateRoutine(r.id, { name: 'legs' })).rejects.toThrow('already exists');
  });

  it('duplicates with a free "(copy)" name and an independent list', async () => {
    const r = await createRoutine('Push', ['bench']);
    const c1 = await duplicateRoutine(r.id);
    const c2 = await duplicateRoutine(r.id);
    expect([c1.name, c2.name]).toEqual(['Push (copy)', 'Push (copy 2)']);
    await updateRoutine(c1.id, { exerciseIds: ['dips'] });
    expect((await getRoutine(r.id))?.exerciseIds).toEqual(['bench']);
  });

  it('copy names stay within the length limit', () => {
    const long = 'x'.repeat(60);
    expect(copyName(long, []).length).toBe(60);
    expect(copyName(long, []).endsWith(' (copy)')).toBe(true);
  });

  it('deletes', async () => {
    const r = await createRoutine('Temp');
    await deleteRoutine(r.id);
    expect(await getRoutine(r.id)).toBeUndefined();
  });

  it('moveItem swaps neighbours and ignores out-of-range moves', () => {
    expect(moveItem(['a', 'b', 'c'], 0, 1)).toEqual(['b', 'a', 'c']);
    expect(moveItem(['a', 'b', 'c'], 2, -1)).toEqual(['a', 'c', 'b']);
    expect(moveItem(['a', 'b'], 0, -1)).toEqual(['a', 'b']);
    expect(moveItem(['a', 'b'], 1, 1)).toEqual(['a', 'b']);
  });
});
