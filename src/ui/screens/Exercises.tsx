import { useEffect, useRef, useState } from 'preact/hooks';
import {
  addExercise,
  listExercises,
  MAX_NAME_LENGTH,
  renameExercise,
  setExerciseArchived,
} from '../../db/exercises';
import type { Exercise } from '../../db/types';
import { ScreenHeader } from '../components/ScreenHeader';
import { errorMessage as message } from '../errors';

export function Exercises() {
  const [all, setAll] = useState<Exercise[] | null>(null);
  const [newName, setNewName] = useState('');
  const [addError, setAddError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);

  const reload = () => listExercises({ includeArchived: true }).then(setAll);
  useEffect(() => void reload(), []);

  const active = all?.filter((e) => !e.archived) ?? [];
  const archived = all?.filter((e) => e.archived) ?? [];

  async function onAdd(ev: Event) {
    ev.preventDefault();
    // Take the name and clear the field now, so typing the next one while this
    // saves can't be merged into it or wiped by a late clear.
    const name = newName;
    if (!name.trim()) return;
    setNewName('');
    try {
      await addExercise(name);
      setAddError(null);
      await reload();
    } catch (e) {
      setNewName((current) => current || name);
      setAddError(message(e));
    }
  }

  async function onUnarchive(id: string) {
    await setExerciseArchived(id, false);
    await reload();
  }

  return (
    <section>
      <ScreenHeader title="Exercises" back="/train" />

      <form class="row" onSubmit={onAdd}>
        <input
          class="grow"
          type="text"
          placeholder="New exercise, e.g. Bench press"
          value={newName}
          maxLength={MAX_NAME_LENGTH}
          enterKeyHint="done"
          autocapitalize="sentences"
          onInput={(e) => {
            setNewName(e.currentTarget.value);
            setAddError(null);
          }}
        />
        <button type="submit" class="primary" disabled={!newName.trim()}>
          Add
        </button>
      </form>
      {addError && <p class="error">{addError}</p>}

      {all === null ? (
        <p class="muted">Loading…</p>
      ) : active.length === 0 ? (
        <p class="muted">No exercises yet. Add the ones you train, then build routines from them.</p>
      ) : (
        <ul class="list">
          {active.map((ex) =>
            ex.id === editingId ? (
              <EditRow
                key={ex.id}
                exercise={ex}
                onDone={async () => {
                  setEditingId(null);
                  await reload();
                }}
              />
            ) : (
              <li key={ex.id}>
                <button
                  type="button"
                  class="list-item"
                  onClick={() => {
                    setEditingId(ex.id);
                    setAddError(null);
                  }}
                >
                  {ex.name}
                </button>
              </li>
            ),
          )}
        </ul>
      )}

      {archived.length > 0 && (
        <>
          <button type="button" class="link" onClick={() => setShowArchived(!showArchived)}>
            {showArchived ? 'Hide' : 'Show'} archived ({archived.length})
          </button>
          {showArchived && (
            <ul class="list">
              {archived.map((ex) => (
                <li key={ex.id} class="list-item static">
                  <span class="grow muted">{ex.name}</span>
                  <button type="button" onClick={() => onUnarchive(ex.id)}>
                    Unarchive
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}

function EditRow({ exercise, onDone }: { exercise: Exercise; onDone: () => void }) {
  const [name, setName] = useState(exercise.name);
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    // Select the current name so typing replaces it; tapping keeps it for small fixes.
    input.current?.focus();
    input.current?.select();
  }, []);

  async function onSave(ev: Event) {
    ev.preventDefault();
    try {
      if (name.trim() !== exercise.name) await renameExercise(exercise.id, name);
      onDone();
    } catch (e) {
      setError(message(e));
    }
  }

  async function onArchive() {
    try {
      await setExerciseArchived(exercise.id, true);
      onDone();
    } catch (e) {
      setError(message(e));
    }
  }

  return (
    <li class="edit-row">
      <form onSubmit={onSave}>
        <input
          ref={input}
          type="text"
          value={name}
          maxLength={MAX_NAME_LENGTH}
          enterKeyHint="done"
          onInput={(e) => {
            setName(e.currentTarget.value);
            setError(null);
          }}
        />
        {error && <p class="error">{error}</p>}
        <div class="row">
          <button type="submit" class="primary">Save</button>
          <button type="button" onClick={onDone}>Cancel</button>
          <span class="grow" />
          <button type="button" onClick={onArchive}>Archive</button>
        </div>
      </form>
      <p class="muted small">Archiving hides it from new workouts and routines. Its history is kept.</p>
    </li>
  );
}
