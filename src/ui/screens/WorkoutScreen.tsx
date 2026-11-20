import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { addExercise, listExercises, type ExerciseDetails } from '../../db/exercises';
import { MuscleLine } from '../components/CatalogSuggestions';
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
import { extraRow, initialPendingRows, type PendingRow } from '../../domain/sets';
import { navigate, previousPath } from '../../router';
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
  // Only one exercise is expanded at a time. Picked automatically once everything has loaded.
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const autoPicked = useRef(false);

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

  useEffect(() => {
    if (autoPicked.current || !workout || previous.size < new Set(workout.exercises.map((s) => s.exerciseId)).size) return;
    autoPicked.current = true;
    const ordered = [...workout.exercises].sort((a, b) => a.order - b.order);
    // The first exercise with sets still to do (resuming), else the first one.
    const todo = ordered.find((slot) => {
      const done = sets.filter((s) => s.workoutExerciseId === slot.id).length;
      return done === 0 || done < (previous.get(slot.exerciseId)?.sets.length ?? 0);
    });
    setExpandedId((todo ?? ordered[0])?.id ?? null);
  }, [workout, previous, sets]);

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
    else
      await act(async () => {
        const u = await addSlot(w.id, exerciseId);
        setExpandedId(u.exercises.find((s) => s.exerciseId === exerciseId)?.id ?? null);
      });
  }

  async function onCreate(name: string, details?: ExerciseDetails) {
    await act(async () => {
      const ex = await addExercise(name, details);
      if (picker?.mode === 'swap') {
        await swapSlot(w.id, picker.slot.id, ex.id);
        setPicker(null);
      } else {
        const u = await addSlot(w.id, ex.id);
        setExpandedId(u.exercises.find((s) => s.exerciseId === ex.id)?.id ?? null);
      }
    });
  }

  return (
    <section>
      {/* A past workout opened from the Train calendar goes back there; otherwise to History. */}
      <ScreenHeader
        title={w.routineName ?? 'Workout'}
        back={active || previousPath() === '/train' ? '/train' : '/train/history'}
      />
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

      {slots.map((slot, i) => (
        <ExerciseCard
          // A swap gives a new key, so the offered rows restart from the new exercise's last time.
          key={`${slot.id}:${slot.exerciseId}`}
          name={byId.get(slot.exerciseId)?.name ?? 'Unknown exercise'}
          exercise={byId.get(slot.exerciseId)}
          sets={sets.filter((s) => s.workoutExerciseId === slot.id)}
          previous={previous.get(slot.exerciseId)}
          active={active}
          expanded={expandedId === slot.id}
          onToggle={() => setExpandedId((cur) => (cur === slot.id ? null : slot.id))}
          onComplete={() => active && slots[i + 1] && setExpandedId(slots[i + 1].id)}
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
  exercise?: Exercise;
  sets: WorkoutSet[];
  previous: PreviousPerformance | null | undefined;
  /** Live workout: rows from last time are offered to record. Past workouts show only what was done. */
  active: boolean;
  expanded: boolean;
  onToggle: () => void;
  /** Called after the last offered row has been recorded. */
  onComplete: () => void;
  onAddSet: (input: SetInput) => Promise<boolean>;
  onUpdateSet: (id: string, input: SetInput) => Promise<boolean>;
  onDeleteSet: (id: string) => Promise<boolean>;
  onSwap: () => void;
  onRemove: () => void;
}) {
  const { sets, previous } = props;
  const [editingId, setEditingId] = useState<string | null>(null);
  // Rows not recorded yet. Null until last time's sets have loaded. Kept while collapsed.
  const [pending, setPending] = useState<PendingRow[] | null>(null);
  const [busyKey, setBusyKey] = useState<number | null>(null);

  // Last time's sets give this exercise a set count to work through. Without them (first
  // time), there's always one suggested next row, which doesn't count as "to do".
  const hadPlan = (previous?.sets.length ?? 0) > 0;

  useEffect(() => {
    if (pending !== null || previous === undefined) return;
    if (!props.active) return setPending([]);
    const last = sets[sets.length - 1];
    setPending(!hadPlan && last ? [extraRow(last)] : initialPendingRows(sets.length, previous?.sets ?? null));
  }, [previous]);

  const rows = pending ?? [];
  const toDo = hadPlan ? rows.length : 0;
  const planned = sets.length + toDo;
  const done = sets.length > 0 && toDo === 0;
  const prevAt = (i: number) => {
    const p = previous?.sets[i];
    return p ? formatSet(p) : '—';
  };

  async function record(r: PendingRow) {
    if (busyKey !== null) return;
    setBusyKey(r.key);
    const ok = await props.onAddSet({ reps: r.reps, weightKg: r.weight });
    setBusyKey(null);
    if (!ok) return;
    const left = rows.filter((x) => x.key !== r.key);
    if (left.length === 0 && !hadPlan) {
      // First time for this exercise: there's no set count to finish, so offer the next set
      // (same values) instead of moving on. The user opens the next exercise when ready.
      setPending((cur) => [...(cur ?? []).filter((x) => x.key !== r.key), extraRow(r)]);
      return;
    }
    setPending((cur) => (cur ?? []).filter((x) => x.key !== r.key));
    // All of last time's sets are recorded: open the next exercise.
    if (left.length === 0) props.onComplete();
  }

  const editRow = (key: number, field: 'weight' | 'reps', value: string) =>
    setPending((cur) => (cur ?? []).map((x) => (x.key === key ? { ...x, [field]: value } : x)));

  function addRow() {
    const lastPending = rows[rows.length - 1];
    const lastSaved = sets[sets.length - 1];
    setPending((cur) => [...(cur ?? []), extraRow(lastPending ?? lastSaved ?? previous?.sets[planned] ?? null)]);
  }

  if (!props.expanded)
    return (
      <article class="card ex-card">
        <button type="button" class="ex-head" aria-expanded="false" onClick={props.onToggle}>
          <h3 class="grow">{props.name}</h3>
          <span class={done ? 'ex-progress done' : 'ex-progress'}>
            {done && '✓ '}
            {planned > sets.length ? `${sets.length} / ${planned}` : sets.length} {planned === 1 ? 'set' : 'sets'}
          </span>
          <span class="chev" aria-hidden="true">
            ›
          </span>
        </button>
      </article>
    );

  return (
    <article class="card ex-card open">
      <header class="row">
        <button type="button" class="ex-head grow" aria-expanded="true" onClick={props.onToggle}>
          <h3 class="grow">{props.name}</h3>
          <span class="chev open" aria-hidden="true">
            ›
          </span>
        </button>
        <button type="button" class="small-btn" onClick={props.onSwap}>
          Swap
        </button>
        <button type="button" class="small-btn" aria-label={`Remove ${props.name}`} onClick={props.onRemove}>
          ✕
        </button>
      </header>

      <p class="muted small prev">
        <MuscleLine primary={props.exercise?.primaryMuscles} secondary={props.exercise?.secondaryMuscles} />
        {props.exercise?.primaryMuscles?.length ? <br /> : null}
        {previous === undefined ? ' ' : previous === null ? 'First time' : `Last time · ${formatDay(previous.date)}`}
      </p>

      <div class="set-table">
        <div class="set-line set-head" aria-hidden="true">
          <span>Set</span>
          <span>Previous</span>
          <span>kg</span>
          <span>Reps</span>
          <span />
        </div>

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
            <button
              key={s.id}
              type="button"
              class="set-line done"
              aria-label={`Set ${i + 1} recorded: ${formatSet(s)}. Tap to edit.`}
              onClick={() => setEditingId(s.id)}
            >
              <span class="set-no">{i + 1}</span>
              <span class="prev-cell">{prevAt(i)}</span>
              <span class="val">{s.weightKg === 0 ? 'BW' : formatKg(s.weightKg)}</span>
              <span class="val">{s.reps}</span>
              <span class="check on" aria-hidden="true">
                ✓
              </span>
            </button>
          ),
        )}

        {rows.map((r, j) => {
          const n = sets.length + j + 1;
          return (
            <form
              key={r.key}
              class="set-line"
              onSubmit={(e) => {
                e.preventDefault();
                void record(r);
              }}
            >
              <span class="set-no">{n}</span>
              <span class="prev-cell">{prevAt(n - 1)}</span>
              <input
                type="text"
                inputMode="decimal"
                enterKeyHint="next"
                aria-label={`${props.name} set ${n} weight in kg`}
                placeholder="kg"
                value={r.weight}
                onInput={(e) => editRow(r.key, 'weight', e.currentTarget.value)}
              />
              <input
                type="text"
                inputMode="numeric"
                enterKeyHint="done"
                aria-label={`${props.name} set ${n} reps`}
                placeholder="reps"
                value={r.reps}
                onInput={(e) => editRow(r.key, 'reps', e.currentTarget.value)}
              />
              <button
                type="submit"
                class="check"
                aria-label={`Record set ${n}`}
                disabled={busyKey !== null || !r.reps.trim()}
              >
                ✓
              </button>
            </form>
          );
        })}
      </div>

      <button type="button" class="link add-set" onClick={addRow}>
        + Add set
      </button>
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
    <div class="set-edit">
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
    </div>
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
