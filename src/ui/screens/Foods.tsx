import { useEffect, useState } from 'preact/hooks';
import { getFood, listFoods, setFoodArchived, setFoodFavourite, updateFood } from '../../db/foods';
import type { Food, FoodBasis } from '../../db/types';
import { MAX_NAME_LENGTH } from '../../db/validation';
import { basisLabel, formatMacros } from '../../domain/food';
import { formatKg } from '../../domain/format';
import { navigate } from '../../router';
import { ScreenHeader } from '../components/ScreenHeader';
import { errorMessage } from '../errors';

/** The personal food list: search, open to edit, archived ones on request. */
export function Foods() {
  const [foods, setFoods] = useState<Food[] | null>(null);
  const [query, setQuery] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  useEffect(() => void listFoods({ includeArchived: true }).then(setFoods), []);

  if (foods === null) return <p class="muted">Loading…</p>;
  const q = query.trim().toLowerCase();
  const shown = foods.filter((f) => (showArchived ? f.archived : !f.archived) && f.name.toLowerCase().includes(q));
  const archivedCount = foods.filter((f) => f.archived).length;

  return (
    <section>
      <ScreenHeader title="My foods" back="/food" />
      <input type="text" class="search" placeholder="Search" value={query} onInput={(e) => setQuery(e.currentTarget.value)} />
      {foods.length === 0 && <p class="muted">No foods yet. Foods you enter by hand are saved here.</p>}
      <ul class="list">
        {shown.map((f) => (
          <li key={f.id}>
            <a class="list-item history-item" href={`#/food/foods/${f.id}`}>
              <span class="row">
                <strong class="grow ellipsis">{f.name}</strong>
                {f.favourite && <span class="star on">★</span>}
              </span>
              <span class="muted small ellipsis">
                {basisLabel(f)}: {formatMacros(f)}
              </span>
            </a>
          </li>
        ))}
      </ul>
      {archivedCount > 0 && (
        <button type="button" class="link" onClick={() => setShowArchived(!showArchived)}>
          {showArchived ? 'Show active foods' : `Show archived (${archivedCount})`}
        </button>
      )}
    </section>
  );
}

const FIELDS = [
  { key: 'kcal', label: 'Calories', unit: 'kcal' },
  { key: 'proteinG', label: 'Protein', unit: 'g' },
  { key: 'carbsG', label: 'Carbs', unit: 'g' },
  { key: 'fatG', label: 'Fat', unit: 'g' },
] as const;

/** Edit one saved food. Past entries keep the values they were logged with. */
export function FoodEditor({ id }: { id: string }) {
  const [food, setFood] = useState<Food | null | undefined>(undefined);
  const [name, setName] = useState('');
  const [basis, setBasis] = useState<FoodBasis>('per100g');
  const [servingLabel, setServingLabel] = useState('');
  const [macros, setMacros] = useState({ kcal: '', proteinG: '', carbsG: '', fatG: '' });
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);

  const load = (f: Food | undefined) => {
    setFood(f ?? null);
    if (!f) return;
    setName(f.name);
    setBasis(f.basis);
    setServingLabel(f.servingLabel ?? '');
    setMacros({ kcal: formatKg(f.kcal), proteinG: formatKg(f.proteinG), carbsG: formatKg(f.carbsG), fatG: formatKg(f.fatG) });
  };
  useEffect(() => void getFood(id).then(load), [id]);

  if (food === undefined) return <p class="muted">Loading…</p>;
  if (food === null)
    return (
      <section>
        <ScreenHeader title="Food" back="/food/foods" />
        <p class="muted">This food no longer exists.</p>
      </section>
    );

  async function onSave(ev: Event) {
    ev.preventDefault();
    try {
      load(await updateFood(id, { name, basis, servingLabel, macros }));
      setMessage({ text: 'Saved. Past entries are unchanged.' });
    } catch (e) {
      setMessage({ text: errorMessage(e), error: true });
    }
  }

  return (
    <section>
      <ScreenHeader title="Edit food" back="/food/foods" />
      <form class="card manual-form" onSubmit={onSave}>
        <input
          type="text"
          aria-label="Name"
          value={name}
          maxLength={MAX_NAME_LENGTH}
          onInput={(e) => {
            setName(e.currentTarget.value);
            setMessage(null);
          }}
        />
        <div class="segmented" role="radiogroup" aria-label="Values are">
          {(['per100g', 'perServing'] as const).map((b) => (
            <button key={b} type="button" role="radio" aria-checked={basis === b} class={basis === b ? 'on' : ''} onClick={() => setBasis(b)}>
              {b === 'per100g' ? 'per 100 g' : 'per serving'}
            </button>
          ))}
        </div>
        {basis === 'perServing' && (
          <input
            type="text"
            placeholder="Serving name (optional), e.g. bar"
            aria-label="Serving name"
            value={servingLabel}
            maxLength={30}
            onInput={(e) => setServingLabel(e.currentTarget.value)}
          />
        )}
        {FIELDS.map((f) => (
          <label key={f.key} class="measure-row">
            <span class="grow">{f.label}</span>
            <input
              type="text"
              inputMode="decimal"
              aria-label={f.label}
              value={macros[f.key]}
              onInput={(e) => {
                const v = e.currentTarget.value;
                setMacros((cur) => ({ ...cur, [f.key]: v }));
                setMessage(null);
              }}
            />
            <span class="muted unit">{f.unit}</span>
          </label>
        ))}
        {message && <p class={message.error ? 'error' : 'ok'}>{message.text}</p>}
        <button type="submit" class="primary">
          Save
        </button>
      </form>
      <div class="row actions">
        <button type="button" onClick={async () => load(await setFoodFavourite(id, !food.favourite))}>
          {food.favourite ? '★ Favourite' : '☆ Add to favourites'}
        </button>
        <span class="grow" />
        <button
          type="button"
          class="danger"
          onClick={async () => {
            await setFoodArchived(id, !food.archived);
            navigate('/food/foods');
          }}
        >
          {food.archived ? 'Unarchive' : 'Archive'}
        </button>
      </div>
      <p class="muted small">Archived foods are hidden from search and recent. Logged entries are kept.</p>
    </section>
  );
}
