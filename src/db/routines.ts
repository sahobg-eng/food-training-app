import { getDB } from './schema';
import { newId } from './id';
import type { Routine } from './types';
import { byName, cleanName, MAX_NAME_LENGTH, sameName, ValidationError } from './validation';

function assertUnique(all: Routine[], name: string, exceptId?: string) {
  const clash = all.find((r) => r.id !== exceptId && sameName(r.name, name));
  if (clash) throw new ValidationError(`A routine called "${clash.name}" already exists.`);
}

/** Exercise ids in order, without duplicates (a routine lists each exercise once). */
function cleanExerciseIds(ids: string[]): string[] {
  return [...new Set(ids)];
}

export async function listRoutines(): Promise<Routine[]> {
  return (await (await getDB()).getAll('routines')).sort(byName);
}

export async function getRoutine(id: string): Promise<Routine | undefined> {
  return (await getDB()).get('routines', id);
}

export async function createRoutine(rawName: string, exerciseIds: string[] = []): Promise<Routine> {
  const name = cleanName(rawName);
  const tx = (await getDB()).transaction('routines', 'readwrite');
  assertUnique(await tx.store.getAll(), name);
  const now = Date.now();
  const routine: Routine = { id: newId(), name, exerciseIds: cleanExerciseIds(exerciseIds), createdAt: now, updatedAt: now };
  await tx.store.add(routine);
  await tx.done;
  return routine;
}

export async function updateRoutine(
  id: string,
  changes: { name?: string; exerciseIds?: string[] },
): Promise<Routine> {
  const tx = (await getDB()).transaction('routines', 'readwrite');
  const current = await tx.store.get(id);
  if (!current) throw new ValidationError('That routine no longer exists.');
  const updated: Routine = { ...current, updatedAt: Date.now() };
  if (changes.name !== undefined) {
    updated.name = cleanName(changes.name);
    assertUnique(await tx.store.getAll(), updated.name, id);
  }
  if (changes.exerciseIds) updated.exerciseIds = cleanExerciseIds(changes.exerciseIds);
  await tx.store.put(updated);
  await tx.done;
  return updated;
}

/** Name for a copy: "Push day (copy)", then "Push day (copy 2)", ... trimmed to fit. */
export function copyName(base: string, taken: string[]): string {
  for (let n = 1; ; n++) {
    const suffix = n === 1 ? ' (copy)' : ` (copy ${n})`;
    const name = base.slice(0, MAX_NAME_LENGTH - suffix.length).trimEnd() + suffix;
    if (!taken.some((t) => sameName(t, name))) return name;
  }
}

export async function duplicateRoutine(id: string): Promise<Routine> {
  const tx = (await getDB()).transaction('routines', 'readwrite');
  const all = await tx.store.getAll();
  const source = all.find((r) => r.id === id);
  if (!source) throw new ValidationError('That routine no longer exists.');
  const now = Date.now();
  const copy: Routine = {
    id: newId(),
    name: copyName(source.name, all.map((r) => r.name)),
    exerciseIds: [...source.exerciseIds],
    createdAt: now,
    updatedAt: now,
  };
  await tx.store.add(copy);
  await tx.done;
  return copy;
}

/** Deletes the routine only. Past workouts keep their own exercise list and routine name. */
export async function deleteRoutine(id: string): Promise<void> {
  await (await getDB()).delete('routines', id);
}

/** Pure helper: move the item at `from` one step up (-1) or down (+1). */
export function moveItem<T>(items: T[], from: number, delta: -1 | 1): T[] {
  const to = from + delta;
  if (from < 0 || from >= items.length || to < 0 || to >= items.length) return items;
  const next = [...items];
  [next[from], next[to]] = [next[to], next[from]];
  return next;
}
