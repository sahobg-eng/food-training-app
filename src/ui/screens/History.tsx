import { useEffect, useMemo, useState } from 'preact/hooks';
import { listExercises } from '../../db/exercises';
import type { Exercise } from '../../db/types';
import { listFinishedWorkouts, type WorkoutSummary } from '../../db/workouts';
import { parseDateStr } from '../../domain/dates';
import { formatDay, formatDuration } from '../../domain/format';
import { ScreenHeader } from '../components/ScreenHeader';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const PAGE = 30;

export function History() {
  const [items, setItems] = useState<WorkoutSummary[] | null>(null);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [shown, setShown] = useState(PAGE);

  useEffect(() => {
    void listFinishedWorkouts().then(setItems);
    void listExercises({ includeArchived: true }).then(setExercises);
  }, []);

  const names = useMemo(() => new Map(exercises.map((e) => [e.id, e.name])), [exercises]);

  if (items === null) return <p class="muted">Loading…</p>;

  // Group the visible workouts by month, newest first.
  const groups: { label: string; items: WorkoutSummary[] }[] = [];
  for (const it of items.slice(0, shown)) {
    const d = parseDateStr(it.workout.date);
    const label = `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
    if (groups[groups.length - 1]?.label !== label) groups.push({ label, items: [] });
    groups[groups.length - 1].items.push(it);
  }

  return (
    <section>
      <ScreenHeader title="History" back="/train" />
      {items.length === 0 && (
        <p class="muted">
          No finished workouts yet. <a href="#/train/start">Start one</a>, and it shows up here when you tap Finish.
        </p>
      )}
      {groups.map((g) => (
        <div key={g.label}>
          <h2>{g.label}</h2>
          <ul class="list">
            {g.items.map(({ workout: w, setCount }) => {
              const exNames = [...w.exercises].sort((a, b) => a.order - b.order).map((s) => names.get(s.exerciseId) ?? '?');
              return (
                <li key={w.id}>
                  <a class="list-item history-item" href={`#/train/workout/${w.id}`}>
                    <span class="row">
                      <strong class="grow">
                        {formatDay(w.date)} · {w.routineName ?? 'Workout'}
                      </strong>
                      <span class="muted small">{formatDuration(w.durationSec ?? 0)}</span>
                    </span>
                    <span class="muted small ellipsis">
                      {setCount} {setCount === 1 ? 'set' : 'sets'}
                      {exNames.length > 0 && ` · ${exNames.join(', ')}`}
                    </span>
                  </a>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
      {items.length > shown && (
        <button type="button" class="block" onClick={() => setShown(shown + PAGE)}>
          Show more ({items.length - shown} older)
        </button>
      )}
    </section>
  );
}
