import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { addExercise, listExercises } from '../../db/exercises';
import { deleteRoutine, duplicateRoutine, getRoutine, moveItem, updateRoutine } from '../../db/routines';
import type { Exercise, Routine } from '../../db/types';
import { MAX_NAME_LENGTH, sameName } from '../../db/validation';
import { navigate } from '../../router';
import { ScreenHeader } from '../components/ScreenHeader';
import { errorMessage } from '../errors';

export function RoutineEditor({ id }: { id: string }) {
  const [routine, setRoutine] = useState<Routine | null | undefined>(undefined);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  // Latest exercise order, updated synchronously on every change. Taps compute their
  // change from this (not from the last render) so quick taps never act on a stale list.
  const idsRef = useRef<string[]>([]);

  const reloadExercises = () => listExercises({ includeArchived: true }).then(setExercises);

  useEffect(() => {
    setRoutine(undefined);
    void reloadExercises();
    getRoutine(id).then((r) => {
      idsRef.current = r?.exerciseIds ?? [];
      setRoutine(r ?? null);
      setName(r?.name ?? '');
    });
  }, [id]);

  const byId = useMemo(() => new Map(exercises.map((e) => [e.id, e])), [exercises]);

  if (routine === undefined) return <p class="muted">Loading…</p>;
  if (routine === null)
    return (
      <section>
        <ScreenHeader title="Routine" back="/train/routines" />
        <p class="muted">This routine no longer exists.</p>
      </section>
    );

  async function save(changes: { name?: string; exerciseIds?: string[] }) {
    if (changes.exerciseIds) {
      idsRef.current = changes.exerciseIds;
      setRoutine((r) => r && { ...r, exerciseIds: changes.exerciseIds! });
    }
    try {
      const updated = await updateRoutine(id, changes);
      // Saves finish in order; keep showing the newest list, not this save's.
      setRoutine({ ...updated, exerciseIds: idsRef.current });
      setError(null);
      return updated;
    } catch (e) {
      setError(errorMessage(e));
      return null;
    }
  }

  /** Change the exercise list based on its latest state. */
  const changeIds = (fn: (ids: string[]) => string[]) => save({ exerciseIds: fn(idsRef.current) });
  const move = (exId: string, delta: -1 | 1) =>
    changeIds((ids) => moveItem(ids, ids.indexOf(exId), delta));

  async function onRename(ev: Event) {
    ev.preventDefault();
    const updated = await save({ name });
    if (updated) setName(updated.name);
  }

  async function onDuplicate() {
    try {
      const copy = await duplicateRoutine(id);
      navigate(`/train/routines/${copy.id}`);
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  async function onDelete() {
    if (!confirm(`Delete "${routine!.name}"? Past workouts are not affected.`)) return;
    await deleteRoutine(id);
    navigate('/train/routines');
  }

  const ids = routine.exerciseIds;
  const nameChanged = name.trim().replace(/\s+/g, ' ') !== routine.name;

  return (
    <section>
      <ScreenHeader title="Edit routine" back="/train/routines" />

      <form class="row" onSubmit={onRename}>
        <input
          class="grow"
          type="text"
          aria-label="Routine name"
          value={name}
          maxLength={MAX_NAME_LENGTH}
          enterKeyHint="done"
          onInput={(e) => {
            setName(e.currentTarget.value);
            setError(null);
          }}
        />
        {nameChanged && (
          <button type="submit" class="primary">
            Save
          </button>
        )}
      </form>
      {error && <p class="error">{error}</p>}

      <h2>Exercises</h2>
      {ids.length === 0 ? (
        <p class="muted">No exercises yet.</p>
      ) : (
        <ol class="list">
          {ids.map((exId, i) => {
            const ex = byId.get(exId);
            return (
              <li key={exId} class="list-item static">
                <span class="muted small order">{i + 1}</span>
                <span class="grow">
                  {ex?.name ?? 'Unknown exercise'}
                  {ex?.archived && <span class="muted small"> · archived</span>}
                </span>
                <button
                  type="button"
                  class="icon-btn"
                  aria-label="Move up"
                  disabled={i === 0}
                  onClick={() => move(exId, -1)}
                >
                  ↑
                </button>
                <button
                  type="button"
                  class="icon-btn"
                  aria-label="Move down"
                  disabled={i === ids.length - 1}
                  onClick={() => move(exId, 1)}
                >
                  ↓
                </button>
                <button
                  type="button"
                  class="icon-btn"
                  aria-label="Remove"
                  onClick={() => changeIds((ids) => ids.filter((x) => x !== exId))}
                >
                  ✕
                </button>
              </li>
            );
          })}
        </ol>
      )}

      {picking ? (
        <ExercisePicker
          exercises={exercises}
          exclude={ids}
          onPick={(exId) => changeIds((ids) => (ids.includes(exId) ? ids : [...ids, exId]))}
          onCreate={async (raw) => {
            try {
              const ex = await addExercise(raw);
              await reloadExercises();
              await changeIds((ids) => [...ids, ex.id]);
            } catch (e) {
              setError(errorMessage(e));
            }
          }}
          onClose={() => setPicking(false)}
        />
      ) : (
        <button type="button" class="block" onClick={() => setPicking(true)}>
          + Add exercise
        </button>
      )}

      <div class="row actions">
        <button type="button" onClick={onDuplicate}>
          Duplicate
        </button>
        <span class="grow" />
        <button type="button" class="danger" onClick={onDelete}>
          Delete
        </button>
      </div>
    </section>
  );
}

function ExercisePicker(props: {
  exercises: Exercise[];
  exclude: string[];
  onPick: (id: string) => void;
  onCreate: (name: string) => Promise<void>;
  onClose: () => void;
}) {
  const [filter, setFilter] = useState('');
  const q = filter.trim().replace(/\s+/g, ' ');
  const available = props.exercises.filter(
    (e) => !e.archived && !props.exclude.includes(e.id) && e.name.toLowerCase().includes(q.toLowerCase()),
  );
  const exists = props.exercises.some((e) => sameName(e.name, q));

  return (
    <div class="picker">
      <div class="row">
        <input
          class="grow"
          type="text"
          placeholder="Search or create exercise"
          value={filter}
          maxLength={MAX_NAME_LENGTH}
          autocapitalize="sentences"
          onInput={(e) => setFilter(e.currentTarget.value)}
        />
        <button type="button" onClick={props.onClose}>
          Done
        </button>
      </div>
      <ul class="list">
        {available.map((e) => (
          <li key={e.id}>
            <button
              type="button"
              class="list-item"
              onClick={() => {
                props.onPick(e.id);
                setFilter('');
              }}
            >
              {e.name}
            </button>
          </li>
        ))}
        {q && !exists && (
          <li>
            <button
              type="button"
              class="list-item create"
              onClick={async () => {
                await props.onCreate(q);
                setFilter('');
              }}
            >
              + Create "{q}"
            </button>
          </li>
        )}
      </ul>
      {available.length === 0 && !q && <p class="muted small">All your exercises are already in this routine.</p>}
    </div>
  );
}
