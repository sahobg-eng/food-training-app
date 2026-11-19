import { useEffect, useState } from 'preact/hooks';
import { listExercises } from '../../db/exercises';
import { listRoutines } from '../../db/routines';
import type { Workout } from '../../db/types';
import { getActiveWorkout, listFinishedWorkouts } from '../../db/workouts';
import { Timer } from '../components/Timer';
import { getLastExportAt } from '../../db/backup';

const BACKUP_NUDGE_DAYS = 7;
import { ScreenHeader } from '../components/ScreenHeader';

export function TrainHome() {
  const [count, setCount] = useState<number | null>(null);
  const [routineCount, setRoutineCount] = useState<number | null>(null);
  const [active, setActive] = useState<Workout | null | undefined>(undefined);
  const [historyCount, setHistoryCount] = useState<number | null>(null);
  const [lastExport, setLastExport] = useState<number | null | undefined>(undefined);
  useEffect(() => {
    listExercises().then((l) => setCount(l.length), () => setCount(null));
    listRoutines().then((l) => setRoutineCount(l.length), () => setRoutineCount(null));
    getActiveWorkout().then((w) => setActive(w ?? null), () => setActive(null));
    listFinishedWorkouts().then((l) => setHistoryCount(l.length), () => setHistoryCount(null));
    getLastExportAt().then(setLastExport, () => setLastExport(undefined));
  }, []);

  return (
    <section>
      <ScreenHeader title="Train" />
      <BackupNudge lastExport={lastExport} hasData={!!historyCount} />
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
        <a class="menu-item" href="#/train/history">
          <span>History</span>
          <span class="muted">{historyCount ?? ''}</span>
        </a>
      </nav>
    </section>
  );
}

/** Reminds to export once there is training data and no backup in the last week. */
function BackupNudge({ lastExport, hasData }: { lastExport: number | null | undefined; hasData: boolean }) {
  if (!hasData || lastExport === undefined) return null;
  const days = lastExport === null ? null : Math.floor((Date.now() - lastExport) / 86_400_000);
  if (days !== null && days < BACKUP_NUDGE_DAYS) return null;
  return (
    <a class="nudge" href="#/settings">
      <span class="grow">{days === null ? 'No backup yet.' : `Last backup ${days} days ago.`} Your data is only on this phone.</span>
      <strong>Back up ›</strong>
    </a>
  );
}
