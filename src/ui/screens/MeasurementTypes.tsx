import { useEffect, useRef, useState } from 'preact/hooks';
import {
  addMeasurementType,
  listMeasurementTypes,
  renameMeasurementType,
  setMeasurementTypeArchived,
  UNITS,
} from '../../db/measurements';
import type { MeasurementType, MeasurementUnit } from '../../db/types';
import { MAX_NAME_LENGTH } from '../../db/validation';
import { ScreenHeader } from '../components/ScreenHeader';
import { errorMessage } from '../errors';

export function MeasurementTypes() {
  const [all, setAll] = useState<MeasurementType[] | null>(null);
  const [name, setName] = useState('');
  const [unit, setUnit] = useState<MeasurementUnit>('cm');
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);

  const reload = () => listMeasurementTypes({ includeArchived: true }).then(setAll);
  useEffect(() => void reload(), []);

  async function onAdd(ev: Event) {
    ev.preventDefault();
    const n = name;
    if (!n.trim()) return;
    setName('');
    try {
      await addMeasurementType(n, unit);
      setError(null);
      await reload();
    } catch (e) {
      setName((cur) => cur || n);
      setError(errorMessage(e));
    }
  }

  const active = all?.filter((t) => !t.archived) ?? [];
  const archived = all?.filter((t) => t.archived) ?? [];

  return (
    <section>
      <ScreenHeader title="Measurement types" back="/body" />

      <form class="add-type" onSubmit={onAdd}>
        <input
          type="text"
          placeholder="New type, e.g. Waist"
          value={name}
          maxLength={MAX_NAME_LENGTH}
          enterKeyHint="done"
          autocapitalize="sentences"
          onInput={(e) => {
            setName(e.currentTarget.value);
            setError(null);
          }}
        />
        <div class="row">
          <div class="segmented" role="radiogroup" aria-label="Unit">
            {UNITS.map((u) => (
              <button
                key={u}
                type="button"
                role="radio"
                aria-checked={unit === u}
                class={unit === u ? 'on' : ''}
                onClick={() => setUnit(u)}
              >
                {u}
              </button>
            ))}
          </div>
          <span class="grow" />
          <button type="submit" class="primary" disabled={!name.trim()}>
            Add
          </button>
        </div>
      </form>
      {error && <p class="error">{error}</p>}
      <p class="muted small">The unit can't be changed later, so past entries keep their meaning.</p>

      <ul class="list">
        {active.map((t) =>
          t.id === editingId ? (
            <EditTypeRow
              key={t.id}
              type={t}
              onDone={async () => {
                setEditingId(null);
                await reload();
              }}
            />
          ) : (
            <li key={t.id}>
              <button
                type="button"
                class="list-item"
                onClick={() => {
                  setEditingId(t.id);
                  setError(null);
                }}
              >
                <span class="grow">{t.name}</span>
                <span class="muted small">{t.unit}</span>
              </button>
            </li>
          ),
        )}
      </ul>

      {archived.length > 0 && (
        <>
          <button type="button" class="link" onClick={() => setShowArchived(!showArchived)}>
            {showArchived ? 'Hide' : 'Show'} archived ({archived.length})
          </button>
          {showArchived && (
            <ul class="list">
              {archived.map((t) => (
                <li key={t.id} class="list-item static">
                  <span class="grow muted">
                    {t.name} ({t.unit})
                  </span>
                  <button
                    type="button"
                    onClick={async () => {
                      await setMeasurementTypeArchived(t.id, false);
                      await reload();
                    }}
                  >
                    Unarchive
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}

function EditTypeRow({ type, onDone }: { type: MeasurementType; onDone: () => void }) {
  const [name, setName] = useState(type.name);
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    input.current?.focus();
    input.current?.select();
  }, []);

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
      <form
        onSubmit={(ev) => {
          ev.preventDefault();
          void run(async () => {
            if (name.trim() !== type.name) await renameMeasurementType(type.id, name);
          });
        }}
      >
        <input
          ref={input}
          type="text"
          value={name}
          maxLength={MAX_NAME_LENGTH}
          enterKeyHint="done"
          onInput={(e) => {
            setName(e.currentTarget.value);
            setError(null);
          }}
        />
        {error && <p class="error">{error}</p>}
        <div class="row">
          <button type="submit" class="primary">Save</button>
          <button type="button" onClick={onDone}>Cancel</button>
          <span class="grow" />
          <button type="button" onClick={() => run(() => setMeasurementTypeArchived(type.id, true))}>
            Archive
          </button>
        </div>
      </form>
      <p class="muted small">Archiving hides it from logging. Its history is kept.</p>
    </li>
  );
}
