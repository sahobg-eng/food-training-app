import { useEffect, useState } from 'preact/hooks';
import { listRoutines } from '../../db/routines';
import type { Routine } from '../../db/types';
import { getActiveWorkout, startWorkout } from '../../db/workouts';
import { navigate } from '../../router';
import { ScreenHeader } from '../components/ScreenHeader';
import { errorMessage } from '../errors';

export function StartWorkout() {
  const [routines, setRoutines] = useState<Routine[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getActiveWorkout().then((w) => {
      if (w) navigate(`/train/workout/${w.id}`);
      else void listRoutines().then(setRoutines);
    });
  }, []);

  async function start(routineId: string | null) {
    if (busy) return;
    setBusy(true);
    try {
      const w = await startWorkout(routineId);
      navigate(`/train/workout/${w.id}`);
    } catch (e) {
      setError(errorMessage(e));
      setBusy(false);
    }
  }

  return (
    <section>
      <ScreenHeader title="Start workout" back="/train" />
      {error && <p class="error">{error}</p>}
      <button type="button" class="primary block" disabled={busy} onClick={() => start(null)}>
        Empty workout
      </button>
      <h2>From a routine</h2>
      {routines === null ? (
        <p class="muted">Loading…</p>
      ) : routines.length === 0 ? (
        <p class="muted">
          No routines yet. <a href="#/train/routines">Create one</a>, or start an empty workout.
        </p>
      ) : (
        <ul class="list">
          {routines.map((r) => (
            <li key={r.id}>
              <button type="button" class="list-item" disabled={busy} onClick={() => start(r.id)}>
                <span class="grow">{r.name}</span>
                <span class="muted small">
                  {r.exerciseIds.length} {r.exerciseIds.length === 1 ? 'exercise' : 'exercises'}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
