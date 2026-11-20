import type { ComponentChildren } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { listExercises } from '../../db/exercises';
import { listRoutines } from '../../db/routines';
import type { Workout } from '../../db/types';
import { getActiveWorkout, listFinishedWorkouts } from '../../db/workouts';
import { getLastExportAt } from '../../db/backup';
import { ChecklistIcon, DumbbellIcon, PlayIcon } from '../components/Icons';
import { WorkoutCalendar } from '../components/WorkoutCalendar';
import { ScreenHeader } from '../components/ScreenHeader';
import { Timer } from '../components/Timer';

const BACKUP_NUDGE_DAYS = 7;

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
      {count === 0 && historyCount === 0 && !active && (
        <div class="card getting-started">
          <strong>Getting started</strong>
          <ol>
            <li>
              Add the <a href="#/train/exercises">exercises</a> you train.
            </li>
            <li>
              Optionally group them into <a href="#/train/routines">routines</a>, e.g. "Push day".
            </li>
            <li>Start a workout and log your sets.</li>
          </ol>
          <p class="muted small">
            Body measurements and food are on the other tabs. Everything stays on this phone, so back up from
            Settings now and then.
          </p>
        </div>
      )}
      <div class="start-wrap">
        {active ? (
          <a class="start-btn resume-btn" href={`#/train/workout/${active.id}`}>
            <span class="start-label">Resume</span>
            <Timer startedAt={active.startedAt} />
            <span class="start-sub">{active.routineName ?? 'Empty workout'}</span>
          </a>
        ) : (
          <a class="start-btn" href="#/train/start" aria-disabled={active === undefined}>
            <PlayIcon />
            <span class="start-label">Start workout</span>
          </a>
        )}
      </div>

      <nav class="tiles" aria-label="Training">
        <Tile href="#/train/routines" label="Routines" count={routineCount} tone="routines">
          <ChecklistIcon size={48} />
        </Tile>
        <Tile href="#/train/exercises" label="Exercises" count={count} tone="exercises">
          <DumbbellIcon size={48} />
        </Tile>
      </nav>

      <WorkoutCalendar />
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

function Tile(props: {
  href: string;
  label: string;
  count: number | null;
  tone: 'routines' | 'exercises';
  children: ComponentChildren;
}) {
  return (
    <a class={`tile tile-${props.tone}`} href={props.href}>
      {props.count !== null && <span class="tile-count">{props.count}</span>}
      <span class="tile-icon">{props.children}</span>
      <span class="tile-label">{props.label}</span>
    </a>
  );
}
