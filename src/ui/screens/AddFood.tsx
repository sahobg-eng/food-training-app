import { useEffect, useRef, useState } from 'preact/hooks';
import { listFoods, logFood, logManualEntry, recentFoods, setFoodFavourite } from '../../db/foods';
import type { Food } from '../../db/types';
import { MAX_NAME_LENGTH } from '../../db/validation';
import { toDateStr } from '../../domain/dates';
import { basisLabel, formatAmount, formatMacros, macrosForAmount, unitForBasis } from '../../domain/food';
import { formatDay, formatKg } from '../../domain/format';
import { navigate } from '../../router';
import { ScreenHeader } from '../components/ScreenHeader';
import { errorMessage } from '../errors';

export function AddFood({ date: dateParam }: { date: string }) {
  const today = toDateStr();
  const date = dateParam <= today ? dateParam : today;
  const back = date === today ? '/food' : `/food/day/${date}`;

  const [foods, setFoods] = useState<Food[] | null>(null);
  const [recent, setRecent] = useState<Food[]>([]);
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [manualName, setManualName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const reload = async () => {
    const [all, rec] = await Promise.all([listFoods(), recentFoods()]);
    setFoods(all);
    setRecent(rec);
  };
  useEffect(() => void reload(), []);

  async function log(foodId: string, amount: string | number) {
    if (busy) return;
    setBusy(true);
    try {
      await logFood(date, foodId, amount);
      navigate(back);
    } catch (e) {
      setError(errorMessage(e));
      setBusy(false);
    }
  }

  async function toggleFavourite(f: Food) {
    await setFoodFavourite(f.id, !f.favourite);
    await reload();
  }

  const title = date === today ? 'Add food' : `Add food · ${formatDay(date)}`;

  if (manualName !== null)
    return (
      <section>
        <ScreenHeader title={title} back={back} />
        <ManualEntry date={date} initialName={manualName} onCancel={() => setManualName(null)} onLogged={() => navigate(back)} />
      </section>
    );

  if (foods === null) return <p class="muted">Loading…</p>;

  const q = query.trim().toLowerCase();
  const favourites = foods.filter((f) => f.favourite);
  const matches = q ? foods.filter((f) => f.name.toLowerCase().includes(q)) : [];
  const exact = foods.some((f) => f.name.toLowerCase() === q);

  // Selection is per list row ("fav:<id>"), since a food can be in Favourites and Recent.
  const row = (section: string) => (f: Food) => (
    <FoodRow
      key={f.id}
      food={f}
      selected={selectedId === `${section}:${f.id}`}
      busy={busy}
      onSelect={() => {
        const key = `${section}:${f.id}`;
        setSelectedId(selectedId === key ? null : key);
        setError(null);
      }}
      onLog={(amount) => log(f.id, amount)}
      onFavourite={() => toggleFavourite(f)}
    />
  );

  return (
    <section>
      <ScreenHeader title={title} back={back} />
      <input
        type="text"
        class="search"
        placeholder="Search your foods"
        value={query}
        autocapitalize="sentences"
        onInput={(e) => {
          setQuery(e.currentTarget.value);
          setSelectedId(null);
        }}
      />
      {error && <p class="error">{error}</p>}

      {q ? (
        <>
          <ul class="list">{matches.map(row('search'))}</ul>
          {matches.length === 0 && <p class="muted">No saved food matches.</p>}
          {!exact && (
            <button type="button" class="block" onClick={() => setManualName(query.trim())}>
              + New food "{query.trim()}"
            </button>
          )}
        </>
      ) : (
        <>
          {favourites.length > 0 && (
            <>
              <h2>Favourites</h2>
              <ul class="list">{favourites.map(row('fav'))}</ul>
            </>
          )}
          <h2>Recent</h2>
          {recent.length === 0 ? (
            <p class="muted">Foods you log show up here for one-tap re-entry.</p>
          ) : (
            <ul class="list">{recent.map(row('recent'))}</ul>
          )}
          <button type="button" class="block" onClick={() => setManualName('')}>
            + New food
          </button>
        </>
      )}

      <a class="menu-item manage-link" href="#/food/foods">
        <span>My foods</span>
        <span class="muted">{foods.length}</span>
      </a>
    </section>
  );
}

function FoodRow(props: {
  food: Food;
  selected: boolean;
  busy: boolean;
  onSelect: () => void;
  onLog: (amount: string | number) => void;
  onFavourite: () => void;
}) {
  const f = props.food;
  const unit = unitForBasis(f.basis);
  const last = f.lastAmount ?? null;
  return (
    <li class={props.selected ? 'food-row selected' : 'food-row'}>
      <div class="row">
        <button type="button" class="food-main" onClick={props.onSelect}>
          <strong class="ellipsis">{f.name}</strong>
          <span class="muted small ellipsis">
            {basisLabel(f)}: {formatMacros(f)}
          </span>
        </button>
        <button
          type="button"
          class={f.favourite ? 'icon-btn star on' : 'icon-btn star'}
          aria-label={f.favourite ? `Remove ${f.name} from favourites` : `Add ${f.name} to favourites`}
          aria-pressed={f.favourite}
          onClick={props.onFavourite}
        >
          {f.favourite ? '★' : '☆'}
        </button>
        {last !== null && !props.selected && (
          <button
            type="button"
            class="quick-add"
            disabled={props.busy}
            aria-label={`Log ${formatAmount({ amount: last, amountUnit: unit, servingLabel: f.servingLabel })} of ${f.name}`}
            onClick={() => props.onLog(last)}
          >
            + {formatAmount({ amount: last, amountUnit: unit, servingLabel: f.servingLabel })}
          </button>
        )}
      </div>
      {props.selected && <AmountPanel food={f} busy={props.busy} onLog={props.onLog} />}
    </li>
  );
}

function AmountPanel({ food, busy, onLog }: { food: Food; busy: boolean; onLog: (amount: string) => void }) {
  const unit = unitForBasis(food.basis);
  const [amount, setAmount] = useState(formatKg(food.lastAmount ?? (unit === 'g' ? 100 : 1)));
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    input.current?.focus();
    input.current?.select();
  }, []);
  const n = Number(amount.replace(',', '.'));
  const preview = Number.isFinite(n) && n > 0 ? macrosForAmount(food, n) : null;

  return (
    <form
      class="amount-panel"
      onSubmit={(e) => {
        e.preventDefault();
        onLog(amount);
      }}
    >
      <div class="row">
        <input
          ref={input}
          type="text"
          inputMode="decimal"
          enterKeyHint="done"
          aria-label={`Amount in ${unit === 'g' ? 'grams' : 'servings'}`}
          value={amount}
          onInput={(e) => setAmount(e.currentTarget.value)}
        />
        <span class="muted">{unit === 'g' ? 'g' : `× ${food.servingLabel || 'serving'}`}</span>
        <span class="grow" />
        <button type="submit" class="primary" disabled={busy || !preview}>
          Log
        </button>
      </div>
      <p class="muted small">{preview ? formatMacros(preview) : 'Enter an amount.'}</p>
    </form>
  );
}

const MACRO_FIELDS = [
  { key: 'kcal', label: 'Calories', unit: 'kcal' },
  { key: 'proteinG', label: 'Protein', unit: 'g' },
  { key: 'carbsG', label: 'Carbs', unit: 'g' },
  { key: 'fatG', label: 'Fat', unit: 'g' },
] as const;

function ManualEntry(props: { date: string; initialName: string; onCancel: () => void; onLogged: () => void }) {
  const [name, setName] = useState(props.initialName);
  const [amount, setAmount] = useState('');
  const [unit, setUnit] = useState<'g' | 'serving'>('g');
  const [servingLabel, setServingLabel] = useState('');
  const [totals, setTotals] = useState({ kcal: '', proteinG: '', carbsG: '', fatG: '' });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(ev: Event) {
    ev.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      await logManualEntry(props.date, { name, amount, unit, servingLabel, totals });
      props.onLogged();
    } catch (e) {
      setError(errorMessage(e));
      setBusy(false);
    }
  }

  return (
    <form class="card manual-form" onSubmit={onSubmit}>
      <h3>New food</h3>
      <input
        type="text"
        placeholder="Name, e.g. Greek yogurt"
        aria-label="Name"
        value={name}
        maxLength={MAX_NAME_LENGTH}
        autocapitalize="sentences"
        onInput={(e) => {
          setName(e.currentTarget.value);
          setError(null);
        }}
      />
      <div class="row">
        <input
          type="text"
          inputMode="decimal"
          class="amount-input"
          placeholder={unit === 'g' ? '150' : '1'}
          aria-label="Amount eaten"
          value={amount}
          onInput={(e) => {
            setAmount(e.currentTarget.value);
            setError(null);
          }}
        />
        <div class="segmented" role="radiogroup" aria-label="Amount unit">
          {(['g', 'serving'] as const).map((u) => (
            <button key={u} type="button" role="radio" aria-checked={unit === u} class={unit === u ? 'on' : ''} onClick={() => setUnit(u)}>
              {u === 'g' ? 'grams' : 'servings'}
            </button>
          ))}
        </div>
      </div>
      {unit === 'serving' && (
        <input
          type="text"
          placeholder="Serving name (optional), e.g. bar, cup"
          aria-label="Serving name"
          value={servingLabel}
          maxLength={30}
          onInput={(e) => setServingLabel(e.currentTarget.value)}
        />
      )}
      <p class="muted small">Totals for the amount you ate:</p>
      {MACRO_FIELDS.map((f) => (
        <label key={f.key} class="measure-row">
          <span class="grow">{f.label}</span>
          <input
            type="text"
            inputMode="decimal"
            aria-label={f.label}
            value={totals[f.key]}
            onInput={(e) => {
              const v = e.currentTarget.value;
              setTotals((cur) => ({ ...cur, [f.key]: v }));
              setError(null);
            }}
          />
          <span class="muted unit">{f.unit}</span>
        </label>
      ))}
      <p class="muted small">
        It's also saved to your foods ({unit === 'g' ? 'per 100 g' : 'per serving'}), so next time you only enter the amount.
      </p>
      {error && <p class="error">{error}</p>}
      <div class="row">
        <button type="submit" class="primary grow" disabled={busy}>
          Log and save
        </button>
        <button type="button" onClick={props.onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}
