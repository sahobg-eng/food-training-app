import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { addExercise, listExercises } from '../../db/exercises';
import type { Exercise, Workout, WorkoutExerciseSlot, WorkoutSet } from '../../db/types';
import {
  addSet,
  addSlot,
  deleteSet,
  deleteWorkout,
  finishWorkout,
  getPreviousSets,
  getWorkout,
  getWorkoutSets,
  removeSlot,
  swapSlot,
  updateSet,
  updateWorkoutTimes,
  type PreviousPerformance,
} from '../../db/workouts';
import { addDays, atLocalTime, toDateStr, toTimeStr } from '../../domain/dates';
import { formatDay, formatDuration, formatKg, formatSet } from '../../domain/format';
import { navigate } from '../../router';
import { ExercisePicker } from '../components/ExercisePicker';
import { ScreenHeader } from '../components/ScreenHeader';
import { confirmDialog } from '../components/ConfirmDialog';
import { Timer } from '../components/Timer';
import { errorMessage } from '../errors';

type Picker = { mode: 'add' } | { mode: 'swap'; slot: WorkoutExerciseSlot } | null;

export function WorkoutScreen({ id }: { id: string }) {
  const [workout, setWorkout] = useState<Workout | null | undefined>(undefined);
  const [sets, setSets] = useState<WorkoutSet[]>([]);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [previous, setPrevious] = useState<Map<string, PreviousPerformance | null>>(new Map());
  const [picker, setPicker] = useState<Picker>(null);
  const [error, setError] = useState<string | null>(null);
  const [editingTimes, setEditingTimes] = useState(false);

  async function reload() {
    const [w, s, ex] = await Promise.all([
      getWorkout(id),
      getWorkoutSets(id),
      listExercises({ includeArchived: true }),
    ]);
    setExercises(ex);
    setSets(s);
    setWorkout(w ?? null);
    if (w) {
      const prev = new Map<string, PreviousPerformance | null>();
      await Promise.all(
        w.exercises.map(async (slot) => prev.set(slot.exerciseId, await getPreviousSets(slot.exerciseId, w))),
      );
      setPrevious(prev);
    }
  }

  useEffect(() => {
    setWorkout(undefined);
    void reload();
  }, [id]);

  const byId = useMemo(() => new Map(exercises.map((e) => [e.id, e])), [exercises]);

  /** Run a change, then reload; show validation problems instead of throwing. */
  async function act(fn: () => Promise<unknown>): Promise<boolean> {
    try {
      await fn();
      setError(null);
      await reload();
      return true;
    } catch (e) {
      setError(errorMessage(e));
      return false;
    }
  }

  if (workout === undefined) return <p class="muted">Loading…</p>;
  if (workout === null)
    return (
      <section>
        <ScreenHeader title="Workout" back="/train" />
        <p class="muted">This workout no longer exists.</p>
      </section>
    );

  const w = workout;
  const active = w.endedAt === null;
  const slots = [...w.exercises].sort((a, b) => a.order - b.order);

  async function onFinish() {
    if (
      sets.length === 0 &&
      !(await confirmDialog({ title: 'No sets logged', message: 'Finish this workout anyway?', confirmLabel: 'Finish' }))
    )
      return;
    if (await act(() => finishWorkout(w.id))) navigate('/train');
  }

  async function onDelete() {
    const what = sets.length ? ` and its ${sets.length} ${sets.length === 1 ? 'set' : 'sets'}` : '';
    const ok = await confirmDialog({
      title: active ? 'Discard this workout?' : 'Delete this workout?',
      message: `This deletes the workout${what}. It can't be undone.`,
      confirmLabel: active ? 'Discard' : 'Delete',
      danger: true,
    });
    if (!ok) return;
    await deleteWorkout(w.id);
    navigate(active ? '/train' : '/train/history');
  }

  async function onRemoveSlot(slot: WorkoutExerciseSlot) {
    const n = sets.filter((s) => s.workoutExerciseId === slot.id).length;
    const name = byId.get(slot.exerciseId)?.name ?? 'this exercise';
    if (
      n &&
      !(await confirmDialog({
        title: `Remove ${name}?`,
        message: `Its ${n} ${n === 1 ? 'set' : 'sets'} in this workout will be deleted.`,
        confirmLabel: 'Remove',
        danger: true,
      }))
    )
      return;
    await act(() => removeSlot(w.id, slot.id));
  }

  async function onPick(exerciseId: string) {
    const p = picker;
    setPicker(p?.mode === 'add' ? p : null);
    if (p?.mode === 'swap') await act(() => swapSlot(w.id, p.slot.id, exerciseId));
    else await act(() => addSlot(w.id, exerciseId));
  }

  async function onCreate(name: string) {
    await act(async () => {
      const ex = await addExercise(name);
      if (picker?.mode === 'swap') {
        await swapSlot(w.id, picker.slot.id, ex.id);
        setPicker(null);
      } else await addSlot(w.id, ex.id);
    });
  }

  return (
    <section>
      <ScreenHeader title={w.routineName ?? 'Workout'} back={active ? '/train' : '/train/history'} />
      <div class="workout-bar">
        <div class="row">
          {active ? (
            <Timer startedAt={w.startedAt} />
          ) : (
            <span class="muted">
              {formatDay(w.date)} · {toTimeStr(w.startedAt)}–{toTimeStr(w.endedAt!)} ·{' '}
              {formatDuration(w.durationSec ?? 0)}
            </span>
          )}
          <span class="grow" />
          {active && (
            <button type="button" class="primary" onClick={onFinish}>
              Finish
            </button>
          )}
          {!active && !editingTimes && (
            <button type="button" class="small-btn" onClick={() => setEditingTimes(true)}>
              Edit time
            </button>
          )}
        </div>
        {editingTimes && (
          <TimesForm
            workout={w}
            onSave={async (start, end) => {
              if (await act(() => updateWorkoutTimes(w.id, start, end))) setEditingTimes(false);
            }}
            onCancel={() => {
              setEditingTimes(false);
              setError(null);
            }}
          />
        )}
        {/* In the sticky bar so it is visible wherever the set was entered. */}
        {error && <p class="error">{error}</p>}
      </div>

      {slots.length === 0 && <p class="muted">No exercises yet. Add the first one below.</p>}

      {slots.map((slot) => (
        <ExerciseCard
          key={slot.id}
          name={byId.get(slot.exerciseId)?.name ?? 'Unknown exercise'}
          sets={sets.filter((s) => s.workoutExerciseId === slot.id)}
          previous={previous.get(slot.exerciseId)}
          onAddSet={(input) => act(() => addSet(w.id, slot.id, input))}
          onUpdateSet={(setId, input) => act(() => updateSet(setId, input))}
          onDeleteSet={(setId) => act(() => deleteSet(setId))}
          onSwap={() => setPicker({ mode: 'swap', slot })}
          onRemove={() => onRemoveSlot(slot)}
        />
      ))}

      {picker ? (
        <ExercisePicker
          exercises={exercises}
          exclude={w.exercises.map((s) => s.exerciseId)}
          onPick={onPick}
          onCreate={onCreate}
          onClose={() => setPicker(null)}
          closeLabel={picker.mode === 'swap' ? 'Cancel' : 'Done'}
          title={
            picker.mode === 'swap' ? `Swap ${byId.get(picker.slot.exerciseId)?.name ?? 'exercise'} for…` : undefined
          }
        />
      ) : (
        <button type="button" class="block" onClick={() => setPicker({ mode: 'add' })}>
          + Add exercise
        </button>
      )}

      <div class="row actions">
        {active && (
          <button type="button" class="primary grow" onClick={onFinish}>
            Finish workout
          </button>
        )}
        {!active && <span class="grow" />}
        <button type="button" class="danger" onClick={onDelete}>
          {active ? 'Discard' : 'Delete'}
        </button>
      </div>
    </section>
  );
}

type SetInput = { reps: string; weightKg: string };

function ExerciseCard(props: {
  name: string;
  sets: WorkoutSet[];
  previous: PreviousPerformance | null | undefined;
  onAddSet: (input: SetInput) => Promise<boolean>;
  onUpdateSet: (id: string, input: SetInput) => Promise<boolean>;
  onDeleteSet: (id: string) => Promise<boolean>;
  onSwap: () => void;
  onRemove: () => void;
}) {
  const { sets, previous } = props;
  const [editingId, setEditingId] = useState<string | null>(null);

  // Prefill: the last set done here, else the first set from last time.
  const seed = sets[sets.length - 1] ?? previous?.sets[0];
  const [weight, setWeight] = useState(seed ? formatKg(seed.weightKg) : '');
  const [reps, setReps] = useState(seed ? String(seed.reps) : '');
  const seeded = useRef(!!seed);
  useEffect(() => {
    // Previous values load after the card mounts; prefill once they arrive.
    if (!seeded.current && seed) {
      seeded.current = true;
      setWeight(formatKg(seed.weightKg));
      setReps(String(seed.reps));
    }
  }, [seed]);

  const [busy, setBusy] = useState(false);
  async function onAdd(ev: Event) {
    ev.preventDefault();
    if (busy) return;
    setBusy(true);
    await props.onAddSet({ reps, weightKg: weight });
    setBusy(false);
  }

  return (
    <article class="card">
      <header class="row">
        <h3 class="grow">{props.name}</h3>
        <button type="button" class="small-btn" onClick={props.onSwap}>
          Swap
        </button>
        <button type="button" class="small-btn" aria-label={`Remove ${props.name}`} onClick={props.onRemove}>
          ✕
        </button>
      </header>

      <p class="muted small prev">
        {previous === undefined
          ? ' '
          : previous === null
            ? 'First time'
            : `Last time · ${formatDay(previous.date)}: ${previous.sets.map(formatSet).join(', ') || 'no sets'}`}
      </p>

      {sets.length > 0 && (
        <ol class="sets">
          {sets.map((s, i) =>
            s.id === editingId ? (
              <SetEditRow
                key={s.id}
                index={i}
                set={s}
                onSave={async (input) => {
                  if (await props.onUpdateSet(s.id, input)) setEditingId(null);
                }}
                onDelete={async () => {
                  const ok = await confirmDialog({
                    title: `Delete set ${i + 1}?`,
                    message: `${props.name}: ${formatSet(s)}`,
                    confirmLabel: 'Delete',
                    danger: true,
                  });
                  if (ok && (await props.onDeleteSet(s.id))) setEditingId(null);
                }}
                onCancel={() => setEditingId(null)}
              />
            ) : (
              <li key={s.id}>
                <button type="button" class="set-row" onClick={() => setEditingId(s.id)}>
                  <span class="muted set-no">{i + 1}</span>
                  <span class="grow">
                    {s.weightKg === 0 ? 'Bodyweight' : `${formatKg(s.weightKg)} kg`} × {s.reps}
                  </span>
                </button>
              </li>
            ),
          )}
        </ol>
      )}

      <form class="set-form" onSubmit={onAdd}>
        <label>
          <span class="muted small">kg</span>
          <input
            type="text"
            inputMode="decimal"
            enterKeyHint="next"
            aria-label={`${props.name} weight in kg`}
            placeholder="0"
            value={weight}
            onInput={(e) => setWeight(e.currentTarget.value)}
          />
        </label>
        <label>
          <span class="muted small">reps</span>
          <input
            type="text"
            inputMode="numeric"
            enterKeyHint="done"
            aria-label={`${props.name} reps`}
            placeholder="0"
            value={reps}
            onInput={(e) => setReps(e.currentTarget.value)}
          />
        </label>
        <button type="submit" class="primary" disabled={busy || !reps.trim()}>
          + Set
        </button>
      </form>
    </article>
  );
}

function SetEditRow(props: {
  index: number;
  set: WorkoutSet;
  onSave: (input: SetInput) => void;
  onDelete: () => void;
  onCancel: () => void;
}) {
  const [weight, setWeight] = useState(formatKg(props.set.weightKg));
  const [reps, setReps] = useState(String(props.set.reps));
  return (
    <li class="set-edit">
      <form
        class="set-form"
        onSubmit={(e) => {
          e.preventDefault();
          props.onSave({ reps, weightKg: weight });
        }}
      >
        <label>
          <span class="muted small">kg</span>
          <input type="text" inputMode="decimal" aria-label="Weight in kg" value={weight} onInput={(e) => setWeight(e.currentTarget.value)} />
        </label>
        <label>
          <span class="muted small">reps</span>
          <input type="text" inputMode="numeric" aria-label="Reps" value={reps} onInput={(e) => setReps(e.currentTarget.value)} />
        </label>
        <button type="submit" class="primary">
          Save
        </button>
      </form>
      <div class="row">
        <span class="muted small grow">Set {props.index + 1}</span>
        <button type="button" class="small-btn" onClick={props.onCancel}>
          Cancel
        </button>
        <button type="button" class="small-btn danger" onClick={props.onDelete}>
          Delete
        </button>
      </div>
    </li>
  );
}

/** Correct a finished workout's date, start and end. An end before the start means past midnight. */
function TimesForm(props: { workout: Workout; onSave: (start: number, end: number) => void; onCancel: () => void }) {
  const w = props.workout;
  const [date, setDate] = useState(w.date);
  const [start, setStart] = useState(toTimeStr(w.startedAt));
  const [end, setEnd] = useState(toTimeStr(w.endedAt ?? w.startedAt));
  const [problem, setProblem] = useState<string | null>(null);

  function compute(): [number, number] | null {
    try {
      const s = atLocalTime(date, start);
      let e = atLocalTime(date, end);
      if (e <= s) e = atLocalTime(addDays(date, 1), end);
      return [s, e];
    } catch {
      return null;
    }
  }
  const range = compute();

  return (
    <form
      class="times-form"
      onSubmit={(ev) => {
        ev.preventDefault();
        if (!range) return setProblem('Enter a date and both times.');
        props.onSave(range[0], range[1]);
      }}
    >
      <label>
        <span class="muted small">Date</span>
        <input type="date" value={date} max={toDateStr()} onInput={(e) => setDate(e.currentTarget.value)} />
      </label>
      <div class="row">
        <label class="grow">
          <span class="muted small">Start</span>
          <input type="time" value={start} onInput={(e) => setStart(e.currentTarget.value)} />
        </label>
        <label class="grow">
          <span class="muted small">End</span>
          <input type="time" value={end} onInput={(e) => setEnd(e.currentTarget.value)} />
        </label>
      </div>
      <p class="muted small">
        {range
          ? `Duration ${formatDuration((range[1] - range[0]) / 1000)}${toDateStr(range[1]) !== date ? ' (ends the next day)' : ''}`
          : (problem ?? 'Enter a date and both times.')}
      </p>
      <div class="row">
        <button type="submit" class="primary" disabled={!range}>
          Save
        </button>
        <button type="button" onClick={props.onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}
