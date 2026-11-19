import { useState } from 'preact/hooks';
import type { Exercise } from '../../db/types';
import { MAX_NAME_LENGTH, sameName } from '../../db/validation';

/**
 * Search the active exercises (minus `exclude`) and pick one, or create a new one
 * from the search text. Used by routines and workouts.
 */
export function ExercisePicker(props: {
  exercises: Exercise[];
  exclude: string[];
  onPick: (id: string) => void;
  onCreate: (name: string) => Promise<void>;
  onClose: () => void;
  closeLabel?: string;
  title?: string;
  emptyNote?: string;
}) {
  const [filter, setFilter] = useState('');
  const q = filter.trim().replace(/\s+/g, ' ');
  const available = props.exercises.filter(
    (e) => !e.archived && !props.exclude.includes(e.id) && e.name.toLowerCase().includes(q.toLowerCase()),
  );
  const exists = props.exercises.some((e) => sameName(e.name, q));

  return (
    <div class="picker">
      {props.title && <p class="picker-title">{props.title}</p>}
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
          {props.closeLabel ?? 'Done'}
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
      {available.length === 0 && !q && <p class="muted small">{props.emptyNote ?? 'No more exercises to add.'}</p>}
    </div>
  );
}
