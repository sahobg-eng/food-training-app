import { useEffect, useState } from 'preact/hooks';
import { listExercises } from '../../db/exercises';
import { ScreenHeader } from '../components/ScreenHeader';

export function TrainHome() {
  const [count, setCount] = useState<number | null>(null);
  useEffect(() => {
    listExercises().then((l) => setCount(l.length), () => setCount(null));
  }, []);

  return (
    <section>
      <ScreenHeader title="Train" />
      <nav class="menu">
        <a class="menu-item" href="#/train/exercises">
          <span>Exercises</span>
          <span class="muted">{count ?? ''}</span>
        </a>
        <div class="menu-item disabled">
          <span>Routines</span>
          <span class="muted">step 4</span>
        </div>
        <div class="menu-item disabled">
          <span>Start workout</span>
          <span class="muted">step 5</span>
        </div>
      </nav>
    </section>
  );
}
