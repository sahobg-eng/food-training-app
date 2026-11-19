import { useEffect, useState } from 'preact/hooks';
import { entriesOn, latestValues, listMeasurementTypes, logMeasurements, type LatestValue } from '../../db/measurements';
import type { MeasurementEntry, MeasurementType } from '../../db/types';
import { toDateStr } from '../../domain/dates';
import { formatChange, formatDay, formatKg } from '../../domain/format';
import { ScreenHeader } from '../components/ScreenHeader';
import { errorMessage } from '../errors';

export function Body() {
  const [types, setTypes] = useState<MeasurementType[] | null>(null);
  const [latest, setLatest] = useState<Map<string, LatestValue>>(new Map());
  const [date, setDate] = useState(toDateStr());
  const [onDate, setOnDate] = useState<Map<string, MeasurementEntry>>(new Map());
  const [values, setValues] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);
  const [busy, setBusy] = useState(false);

  const reload = async () => {
    const [t, l] = await Promise.all([listMeasurementTypes(), latestValues()]);
    setTypes(t);
    setLatest(l);
  };
  useEffect(() => void reload(), []);
  useEffect(() => void entriesOn(date).then(setOnDate), [date]);

  async function onSave(ev: Event) {
    ev.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      const saved = await logMeasurements(
        date,
        Object.entries(values).map(([typeId, value]) => ({ typeId, value })),
      );
      setValues({});
      setMessage({ text: `Saved ${saved.length} ${saved.length === 1 ? 'value' : 'values'} for ${formatDay(date)}.` });
      await reload();
      setOnDate(await entriesOn(date));
    } catch (e) {
      setMessage({ text: errorMessage(e), error: true });
    }
    setBusy(false);
  }

  const anyFilled = Object.values(values).some((v) => v.trim() !== '');

  return (
    <section>
      <ScreenHeader title="Body" />

      <form class="card measure-form" onSubmit={onSave}>
        <label class="row">
          <span class="grow">Date</span>
          <input
            type="date"
            class="date-input"
            value={date}
            max={toDateStr()}
            onInput={(e) => {
              setDate(e.currentTarget.value || toDateStr());
              setMessage(null);
            }}
          />
        </label>
        {types?.map((t) => {
          const existing = onDate.get(t.id);
          const last = latest.get(t.id)?.latest;
          // Each type is its own row: the name in bold, and the last value as text (not as a
          // grey placeholder, which looked like an already-entered value).
          const note = existing
            ? `Logged: ${formatKg(existing.value)} ${t.unit} · saving replaces it`
            : last
              ? `Last: ${formatKg(last.value)} ${t.unit} · ${formatDay(last.date)}`
              : 'No entries yet';
          return (
            <label key={t.id} class="measure-row entry">
              <span class="grow">
                <strong>{t.name}</strong>
                <span class={existing ? 'small warn-note' : 'muted small'}>
                  <br />
                  {note}
                </span>
              </span>
              <input
                type="text"
                inputMode="decimal"
                aria-label={`${t.name} in ${t.unit}`}
                value={values[t.id] ?? ''}
                onInput={(e) => {
                  const v = e.currentTarget.value;
                  setValues((cur) => ({ ...cur, [t.id]: v }));
                  setMessage(null);
                }}
              />
              <span class="muted unit">{t.unit}</span>
            </label>
          );
        })}
        <button type="submit" class="primary" disabled={busy || !anyFilled}>
          Save
        </button>
        {message && <p class={message.error ? 'error' : 'ok'}>{message.text}</p>}
      </form>

      <h2>Latest</h2>
      {types && (
        <ul class="list">
          {types.map((t) => {
            const l = latest.get(t.id);
            return (
              <li key={t.id}>
                <a class="list-item history-item" href={`#/body/type/${t.id}`}>
                  <span class="row">
                    <strong class="grow">{t.name}</strong>
                    <span>{l ? `${formatKg(l.latest.value)} ${t.unit}` : '—'}</span>
                  </span>
                  <span class="muted small">
                    {l
                      ? `${formatDay(l.latest.date)}${l.previous ? ` · ${formatChange(l.latest.value - l.previous.value)} since ${formatDay(l.previous.date)}` : ''}`
                      : 'No entries yet'}
                  </span>
                </a>
              </li>
            );
          })}
        </ul>
      )}

      <a class="menu-item manage-link" href="#/body/types">
        <span>Measurement types</span>
        <span>›</span>
      </a>
    </section>
  );
}
