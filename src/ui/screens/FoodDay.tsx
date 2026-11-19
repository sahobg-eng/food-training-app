import { useEffect, useState } from 'preact/hooks';
import { deleteFoodEntry, entriesForDate, updateFoodEntry } from '../../db/foods';
import { getDayPlan, setDayType, type DayPlan } from '../../db/macros';
import type { FoodEntry } from '../../db/types';
import { addDays, toDateStr } from '../../domain/dates';
import { formatAmount, formatMacros, scaleMacros, sumMacros, type Macros } from '../../domain/food';
import { formatDay, formatKg } from '../../domain/format';
import { navigate } from '../../router';
import { ScreenHeader } from '../components/ScreenHeader';
import { confirmDialog } from '../components/ConfirmDialog';
import { errorMessage } from '../errors';

/** The Food tab for one day (today by default): goal, consumed vs target, and what was eaten. */
export function FoodDay({ date: dateParam }: { date?: string }) {
  const today = toDateStr();
  const date = dateParam && dateParam <= today ? dateParam : today;
  const [plan, setPlan] = useState<DayPlan | null>(null);
  const [entries, setEntries] = useState<FoodEntry[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);

  const reload = async () => {
    const [p, e] = await Promise.all([getDayPlan(date), entriesForDate(date)]);
    setPlan(p);
    setEntries(e);
  };
  useEffect(() => {
    setPlan(null);
    setEditingId(null);
    void reload();
  }, [date]);

  const go = (d: string) => navigate(d === today ? '/food' : `/food/day/${d}`);
  const isToday = date === today;

  async function switchType() {
    if (!plan) return;
    await setDayType(date, plan.dayType === 'workout' ? 'rest' : 'workout');
    await reload();
  }

  const consumed = sumMacros(entries);

  return (
    <section>
      <ScreenHeader title="Food" />
      <div class="day-nav">
        <button type="button" class="icon-btn" aria-label="Previous day" onClick={() => go(addDays(date, -1))}>
          ‹
        </button>
        <strong class="grow center">{isToday ? `Today · ${formatDay(date)}` : formatDay(date)}</strong>
        <button type="button" class="icon-btn" aria-label="Next day" disabled={isToday} onClick={() => go(addDays(date, 1))}>
          ›
        </button>
      </div>
      {!isToday && (
        <button type="button" class="link" onClick={() => go(today)}>
          Back to today
        </button>
      )}

      {plan && (
        <>
          <div class="card day-type">
            <div class="row">
              <span class="grow">
                <strong>{plan.dayType === 'workout' ? 'Workout day' : 'Rest day'}</strong>
                {plan.isOverride && (
                  <span class="muted small">
                    <br />
                    Switched · schedule says {plan.scheduledType}
                  </span>
                )}
              </span>
              <button type="button" class="small-btn" onClick={switchType}>
                Make it a {plan.dayType === 'workout' ? 'rest' : 'workout'} day
              </button>
            </div>
          </div>

          <MacroSummary consumed={consumed} target={plan.target} />
          {!plan.target && (
            <p class="muted small">
              No {plan.dayType} day target yet. <a href="#/food/goals">Set your goals</a> to see what's left.
            </p>
          )}

          <a class="primary-link" href={`#/food/add/${date}`}>
            + Add food
          </a>

          {entries.length === 0 ? (
            <p class="muted">Nothing logged {isToday ? 'yet today' : 'on this day'}.</p>
          ) : (
            <ul class="list">
              {entries.map((e) =>
                e.id === editingId ? (
                  <EditEntryRow
                    key={e.id}
                    entry={e}
                    onDone={async () => {
                      setEditingId(null);
                      await reload();
                    }}
                  />
                ) : (
                  <li key={e.id}>
                    <button type="button" class="list-item history-item" onClick={() => setEditingId(e.id)}>
                      <span class="row">
                        <strong class="grow ellipsis">{e.name}</strong>
                        <span class="muted small">{formatAmount(e)}</span>
                      </span>
                      <span class="muted small">{formatMacros(e)}</span>
                    </button>
                  </li>
                ),
              )}
            </ul>
          )}
        </>
      )}

      <a class="menu-item manage-link" href="#/food/goals">
        <span>Goals and weekly schedule</span>
        <span>›</span>
      </a>
    </section>
  );
}

const ROWS: { key: keyof Macros; label: string; unit: string }[] = [
  { key: 'kcal', label: 'Calories', unit: 'kcal' },
  { key: 'proteinG', label: 'Protein', unit: 'g' },
  { key: 'carbsG', label: 'Carbs', unit: 'g' },
  { key: 'fatG', label: 'Fat', unit: 'g' },
];

const show = (key: keyof Macros, n: number) => (key === 'kcal' ? String(Math.round(n)) : formatKg(Math.round(n)));

/** Consumed against target with the remaining amount (or how much over). */
export function MacroSummary({ consumed, target }: { consumed: Macros; target: Macros | null }) {
  return (
    <div class="summary">
      {ROWS.map(({ key, label, unit }) => {
        // Work in the rounded numbers that are shown, so eaten + left always equals the target.
        const eaten = Math.round(consumed[key]);
        const goal = target ? Math.round(target[key]) : null;
        const left = goal === null ? null : goal - eaten;
        const pct = goal ? Math.min(100, (eaten / goal) * 100) : 0;
        const over = left !== null && left < 0;
        return (
          <div key={key} class={key === 'kcal' ? 'summary-row main' : 'summary-row'}>
            <div class="row">
              <span class="grow">{label}</span>
              <span class="nums">
                <strong>{show(key, eaten)}</strong>
                {goal !== null && <span class="muted"> / {show(key, goal)}</span>} <span class="muted small">{unit}</span>
              </span>
            </div>
            {goal !== null && (
              <>
                <div class="bar" role="presentation">
                  <div class={over ? 'fill over' : 'fill'} style={{ width: `${pct}%` }} />
                </div>
                <span class={over ? 'small over-text' : 'muted small'}>
                  {over ? `${show(key, -left!)} ${unit} over` : `${show(key, left!)} ${unit} left`}
                </span>
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}

type Inputs = { amount: string } & Record<keyof Macros, string>;

function EditEntryRow({ entry, onDone }: { entry: FoodEntry; onDone: () => void }) {
  const [inputs, setInputs] = useState<Inputs>({
    amount: formatKg(entry.amount),
    kcal: formatKg(entry.kcal),
    proteinG: formatKg(entry.proteinG),
    carbsG: formatKg(entry.carbsG),
    fatG: formatKg(entry.fatG),
  });
  const [error, setError] = useState<string | null>(null);

  /** Changing the amount scales the totals from this entry's own values. */
  function onAmount(raw: string) {
    const n = Number(raw.replace(',', '.'));
    if (Number.isFinite(n) && n > 0) {
      const m = scaleMacros(entry, n / entry.amount);
      setInputs({ amount: raw, kcal: formatKg(m.kcal), proteinG: formatKg(m.proteinG), carbsG: formatKg(m.carbsG), fatG: formatKg(m.fatG) });
    } else setInputs((cur) => ({ ...cur, amount: raw }));
    setError(null);
  }

  async function run(fn: () => Promise<unknown>) {
    try {
      await fn();
      onDone();
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  return (
    <li class="edit-row">
      <strong>{entry.name}</strong>
      <form
        onSubmit={(ev) => {
          ev.preventDefault();
          void run(() => updateFoodEntry(entry.id, { amount: inputs.amount, totals: inputs }));
        }}
      >
        <label class="measure-row">
          <span class="grow">Amount</span>
          <input type="text" inputMode="decimal" aria-label="Amount" value={inputs.amount} onInput={(e) => onAmount(e.currentTarget.value)} />
          <span class="muted unit">{entry.amountUnit === 'g' ? 'g' : '×'}</span>
        </label>
        {ROWS.map(({ key, label, unit }) => (
          <label key={key} class="measure-row">
            <span class="grow">{label}</span>
            <input
              type="text"
              inputMode="decimal"
              aria-label={label}
              value={inputs[key]}
              onInput={(e) => {
                const v = e.currentTarget.value;
                setInputs((cur) => ({ ...cur, [key]: v }));
                setError(null);
              }}
            />
            <span class="muted unit">{unit}</span>
          </label>
        ))}
        {error && <p class="error">{error}</p>}
        <div class="row">
          <button type="submit" class="primary">Save</button>
          <button type="button" onClick={onDone}>Cancel</button>
          <span class="grow" />
          <button
            type="button"
            class="danger"
            onClick={async () => {
              const ok = await confirmDialog({
                title: `Delete ${entry.name}?`,
                message: `${formatAmount(entry)} · ${Math.round(entry.kcal)} kcal. This can't be undone.`,
                confirmLabel: 'Delete',
                danger: true,
              });
              if (ok) void run(() => deleteFoodEntry(entry.id));
            }}
          >
            Delete
          </button>
        </div>
      </form>
      <p class="muted small">Changes apply to this entry only, not to the saved food.</p>
    </li>
  );
}
