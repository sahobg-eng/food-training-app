import { useEffect, useState } from 'preact/hooks';
import { createRoutine, listRoutines } from '../../db/routines';
import type { Routine } from '../../db/types';
import { MAX_NAME_LENGTH } from '../../db/validation';
import { navigate } from '../../router';
import { ScreenHeader } from '../components/ScreenHeader';
import { errorMessage } from '../errors';

export function Routines() {
  const [routines, setRoutines] = useState<Routine[] | null>(null);
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => void listRoutines().then(setRoutines), []);

  async function onCreate(ev: Event) {
    ev.preventDefault();
    if (busy || !name.trim()) return;
    setBusy(true);
    try {
      const r = await createRoutine(name);
      navigate(`/train/routines/${r.id}`);
    } catch (e) {
      setError(errorMessage(e));
      setBusy(false);
    }
  }

  return (
    <section>
      <ScreenHeader title="Routines" back="/train" />

      <form class="row" onSubmit={onCreate}>
        <input
          class="grow"
          type="text"
          placeholder="New routine, e.g. Push day"
          value={name}
          maxLength={MAX_NAME_LENGTH}
          enterKeyHint="done"
          autocapitalize="sentences"
          onInput={(e) => {
            setName(e.currentTarget.value);
            setError(null);
          }}
        />
        <button type="submit" class="primary" disabled={!name.trim() || busy}>
          Create
        </button>
      </form>
      {error && <p class="error">{error}</p>}

      {routines === null ? (
        <p class="muted">Loading…</p>
      ) : routines.length === 0 ? (
        <p class="muted">No routines yet. Create one, then add exercises in the order you do them.</p>
      ) : (
        <ul class="list">
          {routines.map((r) => (
            <li key={r.id}>
              <a class="list-item" href={`#/train/routines/${r.id}`}>
                <span class="grow">{r.name}</span>
                <span class="muted small">
                  {r.exerciseIds.length} {r.exerciseIds.length === 1 ? 'exercise' : 'exercises'}
                </span>
              </a>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
