import { useEffect, useState } from 'preact/hooks';
import { listExercises } from '../../db/exercises';
import { listRoutines } from '../../db/routines';
import type { Workout } from '../../db/types';
import { getActiveWorkout } from '../../db/workouts';
import { Timer } from '../components/Timer';
import { ScreenHeader } from '../components/ScreenHeader';

export function TrainHome() {
  const [count, setCount] = useState<number | null>(null);
  const [routineCount, setRoutineCount] = useState<number | null>(null);
  const [active, setActive] = useState<Workout | null | undefined>(undefined);
  useEffect(() => {
    listExercises().then((l) => setCount(l.length), () => setCount(null));
    listRoutines().then((l) => setRoutineCount(l.length), () => setRoutineCount(null));
    getActiveWorkout().then((w) => setActive(w ?? null), () => setActive(null));
  }, []);

  return (
    <section>
      <ScreenHeader title="Train" />
      {active && (
        <a class="resume" href={`#/train/workout/${active.id}`}>
          <span class="grow">
            <strong>Workout in progress</strong>
            <span class="muted small"> · {active.routineName ?? 'Empty workout'}</span>
          </span>
          <Timer startedAt={active.startedAt} />
        </a>
      )}
      <nav class="menu">
        {active === null && (
          <a class="menu-item primary-item" href="#/train/start">
            <span>Start workout</span>
            <span>›</span>
          </a>
        )}
        <a class="menu-item" href="#/train/exercises">
          <span>Exercises</span>
          <span class="muted">{count ?? ''}</span>
        </a>
        <a class="menu-item" href="#/train/routines">
          <span>Routines</span>
          <span class="muted">{routineCount ?? ''}</span>
        </a>
        <div class="menu-item disabled">
          <span>History</span>
          <span class="muted">step 6</span>
        </div>
      </nav>
    </section>
  );
}
