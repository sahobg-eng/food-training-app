import { useEffect, useState } from 'preact/hooks';
import { listExercises } from '../../db/exercises';
import { listRoutines } from '../../db/routines';
import { ScreenHeader } from '../components/ScreenHeader';

export function TrainHome() {
  const [count, setCount] = useState<number | null>(null);
  const [routineCount, setRoutineCount] = useState<number | null>(null);
  useEffect(() => {
    listExercises().then((l) => setCount(l.length), () => setCount(null));
    listRoutines().then((l) => setRoutineCount(l.length), () => setRoutineCount(null));
  }, []);

  return (
    <section>
      <ScreenHeader title="Train" />
      <nav class="menu">
        <a class="menu-item" href="#/train/exercises">
          <span>Exercises</span>
          <span class="muted">{count ?? ''}</span>
        </a>
        <a class="menu-item" href="#/train/routines">
          <span>Routines</span>
          <span class="muted">{routineCount ?? ''}</span>
        </a>
        <div class="menu-item disabled">
          <span>Start workout</span>
          <span class="muted">step 5</span>
        </div>
      </nav>
    </section>
  );
}
