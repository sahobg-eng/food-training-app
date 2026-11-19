import { useEffect, useState } from 'preact/hooks';
import { getMacroSettings, setSchedule, setTarget, type MacroValues } from '../../db/macros';
import type { DayType, MacroTarget, ScheduleVersion } from '../../db/types';
import { toDateStr } from '../../domain/dates';
import { kcalFromMacros, targetFor, versionFor, WEEKDAY_LABELS } from '../../domain/macros';
import { formatKg } from '../../domain/format';
import { ScreenHeader } from '../components/ScreenHeader';
import { errorMessage } from '../errors';

export function Goals() {
  const [targets, setTargets] = useState<MacroTarget[] | null>(null);
  const [schedules, setSchedules] = useState<ScheduleVersion[]>([]);

  const reload = async () => {
    const s = await getMacroSettings();
    setTargets(s.targets);
    setSchedules(s.schedules);
  };
  useEffect(() => void reload(), []);

  if (targets === null) return <p class="muted">Loading…</p>;
  const today = toDateStr();
  const days = versionFor(schedules, today)?.workoutWeekdays ?? [];

  async function toggleDay(d: number) {
    await setSchedule(days.includes(d) ? days.filter((x) => x !== d) : [...days, d]);
    await reload();
  }

  return (
    <section>
      <ScreenHeader title="Goals" back="/food" />
      <p class="muted small">Changes apply from today. Past days keep the targets they had.</p>

      <h2>Workout days</h2>
      <div class="weekdays" role="group" aria-label="Workout days">
        {WEEKDAY_LABELS.map((label, d) => (
          <button
            key={label}
            type="button"
            aria-pressed={days.includes(d)}
            class={days.includes(d) ? 'on' : ''}
            onClick={() => toggleDay(d)}
          >
            {label}
          </button>
        ))}
      </div>
      <p class="muted small">
        {days.length} workout {days.length === 1 ? 'day' : 'days'} a week. Any single day can be switched on the Food
        screen.
      </p>

      <TargetForm dayType="workout" current={targetFor(today, 'workout', targets)} onSaved={reload} />
      <TargetForm dayType="rest" current={targetFor(today, 'rest', targets)} onSaved={reload} />
    </section>
  );
}

const FIELDS: { key: keyof MacroValues; label: string; unit: string }[] = [
  { key: 'kcal', label: 'Calories', unit: 'kcal' },
  { key: 'proteinG', label: 'Protein', unit: 'g' },
  { key: 'carbsG', label: 'Carbs', unit: 'g' },
  { key: 'fatG', label: 'Fat', unit: 'g' },
];

type Inputs = Record<keyof MacroValues, string>;

const toInputs = (t: MacroTarget | null): Inputs => ({
  kcal: t ? String(t.kcal) : '',
  proteinG: t ? formatKg(t.proteinG) : '',
  carbsG: t ? formatKg(t.carbsG) : '',
  fatG: t ? formatKg(t.fatG) : '',
});

function TargetForm(props: { dayType: DayType; current: MacroTarget | null; onSaved: () => void }) {
  const [inputs, setInputs] = useState<Inputs>(toInputs(props.current));
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);
  const saved = toInputs(props.current);
  const changed = FIELDS.some((f) => inputs[f.key].trim() !== saved[f.key]);

  const num = (s: string) => Number(s.replace(',', '.')) || 0;
  const implied = kcalFromMacros({ proteinG: num(inputs.proteinG), carbsG: num(inputs.carbsG), fatG: num(inputs.fatG) });

  async function onSubmit(ev: Event) {
    ev.preventDefault();
    try {
      await setTarget(props.dayType, inputs);
      setMessage({ text: 'Saved. Applies from today.' });
      props.onSaved();
    } catch (e) {
      setMessage({ text: errorMessage(e), error: true });
    }
  }

  return (
    <form class="card target-form" onSubmit={onSubmit}>
      <h3>{props.dayType === 'workout' ? 'Workout day target' : 'Rest day target'}</h3>
      {FIELDS.map((f) => (
        <label key={f.key} class="measure-row">
          <span class="grow">{f.label}</span>
          <input
            type="text"
            inputMode={f.key === 'kcal' ? 'numeric' : 'decimal'}
            aria-label={`${props.dayType === 'workout' ? 'Workout' : 'Rest'} day ${f.label}`}
            value={inputs[f.key]}
            onInput={(e) => {
              const val = e.currentTarget.value;
              setInputs((cur) => ({ ...cur, [f.key]: val }));
              setMessage(null);
            }}
          />
          <span class="muted unit">{f.unit}</span>
        </label>
      ))}
      <p class="muted small">
        Protein, carbs and fat add up to {implied} kcal
        {inputs.kcal.trim() && Math.abs(implied - num(inputs.kcal)) > 50 ? ' (differs from Calories)' : ''}.
      </p>
      <button type="submit" class="primary" disabled={!changed}>
        Save
      </button>
      {message && <p class={message.error ? 'error' : 'ok'}>{message.text}</p>}
    </form>
  );
}
