import { useEffect, useState } from 'preact/hooks';
import { deleteEntry, getMeasurementType, listEntries, updateEntry } from '../../db/measurements';
import type { MeasurementEntry, MeasurementType } from '../../db/types';
import { toDateStr } from '../../domain/dates';
import { formatChange, formatDay, formatKg } from '../../domain/format';
import { ScreenHeader } from '../components/ScreenHeader';
import { confirmDialog } from '../components/ConfirmDialog';
import { errorMessage } from '../errors';

export function MeasurementHistory({ id }: { id: string }) {
  const [type, setType] = useState<MeasurementType | null | undefined>(undefined);
  const [entries, setEntries] = useState<MeasurementEntry[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);

  const reload = async () => {
    const [t, e] = await Promise.all([getMeasurementType(id), listEntries(id)]);
    setType(t ?? null);
    setEntries(e);
  };
  useEffect(() => void reload(), [id]);

  if (type === undefined) return <p class="muted">Loading…</p>;
  if (type === null)
    return (
      <section>
        <ScreenHeader title="Measurement" back="/body" />
        <p class="muted">This measurement type no longer exists.</p>
      </section>
    );

  return (
    <section>
      <ScreenHeader title={type.name} back="/body" />
      {type.archived && <p class="muted small">Archived · unarchive it in Measurement types to log new values.</p>}
      {entries.length === 0 && <p class="muted">No entries yet. Log one on the Body screen.</p>}
      <ul class="list">
        {entries.map((e, i) => {
          const older = entries[i + 1];
          return e.id === editingId ? (
            <EditEntryRow
              key={e.id}
              entry={e}
              unit={type.unit}
              onDone={async () => {
                setEditingId(null);
                await reload();
              }}
            />
          ) : (
            <li key={e.id}>
              <button type="button" class="list-item" onClick={() => setEditingId(e.id)}>
                <span class="grow">{formatDay(e.date)}</span>
                {older && <span class="muted small">{formatChange(e.value - older.value)}</span>}
                <strong class="value">
                  {formatKg(e.value)} {type.unit}
                </strong>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function EditEntryRow(props: { entry: MeasurementEntry; unit: string; onDone: () => void }) {
  const [date, setDate] = useState(props.entry.date);
  const [value, setValue] = useState(formatKg(props.entry.value));
  const [error, setError] = useState<string | null>(null);

  async function run(fn: () => Promise<unknown>) {
    try {
      await fn();
      props.onDone();
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  return (
    <li class="edit-row">
      <form
        onSubmit={(ev) => {
          ev.preventDefault();
          void run(() => updateEntry(props.entry.id, { date, value }));
        }}
      >
        <div class="row">
          <input type="date" class="grow" value={date} max={toDateStr()} onInput={(e) => setDate(e.currentTarget.value)} />
          <input
            type="text"
            inputMode="decimal"
            class="value-input"
            aria-label={`Value in ${props.unit}`}
            value={value}
            onInput={(e) => {
              setValue(e.currentTarget.value);
              setError(null);
            }}
          />
          <span class="muted">{props.unit}</span>
        </div>
        {error && <p class="error">{error}</p>}
        <div class="row">
          <button type="submit" class="primary">Save</button>
          <button type="button" onClick={props.onDone}>Cancel</button>
          <span class="grow" />
          <button
            type="button"
            class="danger"
            onClick={async () => {
              const ok = await confirmDialog({
                title: `Delete the ${formatDay(props.entry.date)} entry?`,
                message: `${formatKg(props.entry.value)} ${props.unit}. This can't be undone.`,
                confirmLabel: 'Delete',
                danger: true,
              });
              if (ok) void run(() => deleteEntry(props.entry.id));
            }}
          >
            Delete
          </button>
        </div>
      </form>
    </li>
  );
}
