import { getDB } from './schema';
import { newId } from './id';
import { MUSCLES, type Exercise, type Muscle } from './types';
import { byName, cleanName, sameName, ValidationError } from './validation';

export { MAX_NAME_LENGTH, ValidationError } from './validation';

function assertUnique(all: Exercise[], name: string, exceptId?: string) {
  const clash = all.find((e) => e.id !== exceptId && sameName(e.name, name));
  if (!clash) return;
  throw new ValidationError(
    clash.archived
      ? `"${clash.name}" already exists in Archived. Unarchive it instead.`
      : `"${clash.name}" already exists.`,
  );
}

/** All exercises sorted by name. Archived ones only when asked. */
export async function listExercises(opts: { includeArchived?: boolean } = {}): Promise<Exercise[]> {
  const all = await (await getDB()).getAll('exercises');
  return all.filter((e) => opts.includeArchived || !e.archived).sort(byName);
}

export async function getExercise(id: string): Promise<Exercise | undefined> {
  return (await getDB()).get('exercises', id);
}

/** Muscles and equipment for an exercise, from the built-in library or set by hand. */
export interface ExerciseDetails {
  primaryMuscles?: Muscle[];
  secondaryMuscles?: Muscle[];
  equipment?: string | null;
  catalogId?: string | null;
}

const VALID = new Set<string>(MUSCLES);

/** Keep known muscles only, no repeats, and nothing both primary and secondary. */
function cleanDetails(d: ExerciseDetails): Required<ExerciseDetails> {
  const pick = (ms: Muscle[] = []) => [...new Set(ms)].filter((m) => VALID.has(m));
  const primaryMuscles = pick(d.primaryMuscles);
  return {
    primaryMuscles,
    secondaryMuscles: pick(d.secondaryMuscles).filter((m) => !primaryMuscles.includes(m)),
    equipment: d.equipment?.trim() || null,
    catalogId: d.catalogId || null,
  };
}

export async function addExercise(rawName: string, details: ExerciseDetails = {}): Promise<Exercise> {
  const name = cleanName(rawName);
  const tx = (await getDB()).transaction('exercises', 'readwrite');
  assertUnique(await tx.store.getAll(), name);
  const exercise: Exercise = { id: newId(), name, archived: false, createdAt: Date.now(), ...cleanDetails(details) };
  await tx.store.add(exercise);
  await tx.done;
  return exercise;
}

export async function renameExercise(id: string, rawName: string): Promise<Exercise> {
  const name = cleanName(rawName);
  const tx = (await getDB()).transaction('exercises', 'readwrite');
  const current = await tx.store.get(id);
  if (!current) throw new ValidationError('That exercise no longer exists.');
  assertUnique(await tx.store.getAll(), name, id);
  const updated = { ...current, name };
  await tx.store.put(updated);
  await tx.done;
  return updated;
}

/** Archived exercises are hidden from pickers but keep all their history. */
export async function setExerciseArchived(id: string, archived: boolean): Promise<Exercise> {
  const tx = (await getDB()).transaction('exercises', 'readwrite');
  const current = await tx.store.get(id);
  if (!current) throw new ValidationError('That exercise no longer exists.');
  const updated = { ...current, archived };
  await tx.store.put(updated);
  await tx.done;
  return updated;
}

/** Set (replace) an exercise's muscles and equipment. Its name and history are unchanged. */
export async function setExerciseDetails(id: string, details: ExerciseDetails): Promise<Exercise> {
  const tx = (await getDB()).transaction('exercises', 'readwrite');
  const current = await tx.store.get(id);
  if (!current) throw new ValidationError('That exercise no longer exists.');
  const updated = { ...current, ...cleanDetails(details) };
  await tx.store.put(updated);
  await tx.done;
  return updated;
}
