import { getDB } from './schema';
import { newId } from './id';
import type { DateStr, Food, FoodBasis, FoodEntry } from './types';
import { byName, cleanName, sameName, ValidationError } from './validation';
import { parseDateStr, toDateStr } from '../domain/dates';
import { macrosForAmount, perBasisFromTotals, roundMacros, unitForBasis, type Macros } from '../domain/food';

const MAX_G = 5000;
const MAX_SERVINGS = 100;
const MAX_KCAL = 10000;
const MAX_MACRO_G = 1000;

function num(raw: string | number, label: string, min: number, max: number, allowZero = true): number {
  const text = typeof raw === 'number' ? String(raw) : raw.trim().replace(',', '.');
  const n = Number(text);
  if (!text || !Number.isFinite(n) || n < min || n > max || (!allowZero && n === 0))
    throw new ValidationError(`${label}: enter ${allowZero ? min : 'more than ' + min} to ${max}.`);
  return n;
}

export function parseAmount(raw: string | number, unit: 'g' | 'serving'): number {
  return Math.round(num(raw, 'Amount', 0, unit === 'g' ? MAX_G : MAX_SERVINGS, false) * 100) / 100;
}

export type MacroInputs = Record<keyof Macros, string | number>;

export function parseMacros(input: MacroInputs): Macros {
  return roundMacros({
    kcal: num(input.kcal, 'Calories', 0, MAX_KCAL),
    proteinG: num(input.proteinG, 'Protein', 0, MAX_MACRO_G),
    carbsG: num(input.carbsG, 'Carbs', 0, MAX_MACRO_G),
    fatG: num(input.fatG, 'Fat', 0, MAX_MACRO_G),
  });
}

/** Per 100 g, protein + carbs + fat can't exceed 100 g (small tolerance for rounding on labels). */
function checkPer100(m: Macros) {
  if (m.proteinG + m.carbsG + m.fatG > 102)
    throw new ValidationError('Per 100 g, protein + carbs + fat can’t be more than 100 g. Check the numbers.');
}

function checkDate(date: DateStr) {
  try {
    parseDateStr(date);
  } catch {
    throw new ValidationError('Invalid date.');
  }
  if (date > toDateStr()) throw new ValidationError('The date cannot be in the future.');
}

function cleanLabel(raw: string | null | undefined): string | null {
  const s = (raw ?? '').trim().replace(/\s+/g, ' ').slice(0, 30);
  return s || null;
}

// ---------- Foods ----------

export async function listFoods(opts: { includeArchived?: boolean } = {}): Promise<Food[]> {
  const all = await (await getDB()).getAll('foods');
  return all.filter((f) => opts.includeArchived || !f.archived).sort(byName);
}

export async function getFood(id: string): Promise<Food | undefined> {
  return (await getDB()).get('foods', id);
}

/** Recently logged foods, most recent first. */
export async function recentFoods(limit = 20): Promise<Food[]> {
  const out: Food[] = [];
  const tx = (await getDB()).transaction('foods');
  let cursor = await tx.store.index('lastUsedAt').openCursor(null, 'prev');
  while (cursor && out.length < limit) {
    if (!cursor.value.archived) out.push(cursor.value);
    cursor = await cursor.continue();
  }
  return out;
}

function assertUniqueFood(all: Food[], name: string, exceptId?: string) {
  const clash = all.find((f) => f.id !== exceptId && sameName(f.name, name));
  if (!clash) return;
  throw new ValidationError(
    clash.archived
      ? `"${clash.name}" is already in your foods (archived). Unarchive it or use another name.`
      : `"${clash.name}" is already in your foods. Pick it from the list, or use another name.`,
  );
}

export interface FoodInput {
  name: string;
  basis: FoodBasis;
  servingLabel?: string | null;
  macros: MacroInputs; // per basis unit
}

function buildFoodFields(input: FoodInput) {
  const name = cleanName(input.name);
  if (input.basis !== 'per100g' && input.basis !== 'perServing') throw new ValidationError('Choose per 100 g or per serving.');
  const macros = parseMacros(input.macros);
  if (input.basis === 'per100g') checkPer100(macros);
  return { name, basis: input.basis, servingLabel: input.basis === 'perServing' ? cleanLabel(input.servingLabel) : null, ...macros };
}

export async function createFood(input: FoodInput): Promise<Food> {
  const fields = buildFoodFields(input);
  const tx = (await getDB()).transaction('foods', 'readwrite');
  assertUniqueFood(await tx.store.getAll(), fields.name);
  const food: Food = { id: newId(), ...fields, favourite: false, archived: false, lastUsedAt: null, lastAmount: null, createdAt: Date.now() };
  await tx.store.add(food);
  await tx.done;
  return food;
}

/** Edit a saved food. Past entries keep their own copied name and macros. */
export async function updateFood(id: string, input: FoodInput): Promise<Food> {
  const fields = buildFoodFields(input);
  const tx = (await getDB()).transaction('foods', 'readwrite');
  const all = await tx.store.getAll();
  const current = all.find((f) => f.id === id);
  if (!current) throw new ValidationError('That food no longer exists.');
  assertUniqueFood(all, fields.name, id);
  // A changed basis makes the remembered amount meaningless.
  const lastAmount = fields.basis === current.basis ? current.lastAmount : null;
  const updated: Food = { ...current, ...fields, lastAmount };
  await tx.store.put(updated);
  await tx.done;
  return updated;
}

async function patchFood(id: string, patch: Partial<Food>): Promise<Food> {
  const tx = (await getDB()).transaction('foods', 'readwrite');
  const current = await tx.store.get(id);
  if (!current) throw new ValidationError('That food no longer exists.');
  const updated = { ...current, ...patch };
  await tx.store.put(updated);
  await tx.done;
  return updated;
}

export const setFoodFavourite = (id: string, favourite: boolean) => patchFood(id, { favourite });
/** Archived foods are hidden from search, recent and favourites. Past entries are unaffected. */
export const setFoodArchived = (id: string, archived: boolean) => patchFood(id, { archived });

// ---------- Entries ----------

let lastStamp = 0;
/** Strictly increasing log time, so entries keep their logging order even within one millisecond. */
function stamp(): number {
  lastStamp = Math.max(Date.now(), lastStamp + 1);
  return lastStamp;
}

export async function entriesForDate(date: DateStr): Promise<FoodEntry[]> {
  const rows = await (await getDB()).getAllFromIndex('foodEntries', 'date', date);
  return rows.sort((a, b) => a.loggedAt - b.loggedAt);
}

/** Log a saved food: only the amount is needed; totals are computed and copied onto the entry. */
export async function logFood(date: DateStr, foodId: string, rawAmount: string | number): Promise<FoodEntry> {
  checkDate(date);
  const tx = (await getDB()).transaction(['foods', 'foodEntries'], 'readwrite');
  const food = await tx.objectStore('foods').get(foodId);
  if (!food) throw new ValidationError('That food no longer exists.');
  const unit = unitForBasis(food.basis);
  const amount = parseAmount(rawAmount, unit);
  const now = stamp();
  const entry: FoodEntry = {
    id: newId(),
    date,
    foodId,
    name: food.name,
    amount,
    amountUnit: unit,
    servingLabel: food.servingLabel,
    ...macrosForAmount(food, amount),
    loggedAt: now,
  };
  await tx.objectStore('foodEntries').add(entry);
  await tx.objectStore('foods').put({ ...food, lastUsedAt: now, lastAmount: amount });
  await tx.done;
  return entry;
}

export interface ManualEntryInput {
  name: string;
  amount: string | number;
  unit: 'g' | 'serving';
  servingLabel?: string | null;
  totals: MacroInputs; // for the amount eaten
}

/**
 * Log a food typed in by hand. The entry stores the totals as entered, and the food is
 * saved to the food list per 100 g (grams) or per serving, so next time only the amount is needed.
 */
export async function logManualEntry(date: DateStr, input: ManualEntryInput): Promise<{ entry: FoodEntry; food: Food }> {
  checkDate(date);
  const name = cleanName(input.name);
  const amount = parseAmount(input.amount, input.unit);
  const totals = parseMacros(input.totals);
  const per = perBasisFromTotals(totals, amount, input.unit);
  const basis: FoodBasis = input.unit === 'g' ? 'per100g' : 'perServing';
  if (basis === 'per100g') checkPer100(per);
  const servingLabel = basis === 'perServing' ? cleanLabel(input.servingLabel) : null;

  const tx = (await getDB()).transaction(['foods', 'foodEntries'], 'readwrite');
  assertUniqueFood(await tx.objectStore('foods').getAll(), name);
  const now = stamp();
  const food: Food = {
    id: newId(),
    name,
    basis,
    servingLabel,
    ...per,
    favourite: false,
    archived: false,
    lastUsedAt: now,
    lastAmount: amount,
    createdAt: now,
  };
  const entry: FoodEntry = {
    id: newId(),
    date,
    foodId: food.id,
    name,
    amount,
    amountUnit: input.unit,
    servingLabel,
    ...totals,
    loggedAt: now,
  };
  await tx.objectStore('foods').add(food);
  await tx.objectStore('foodEntries').add(entry);
  await tx.done;
  return { entry, food };
}

/** Edit a logged entry's amount and totals (the UI scales totals with the amount by default). */
export async function updateFoodEntry(
  id: string,
  input: { amount: string | number; totals: MacroInputs },
): Promise<FoodEntry> {
  const tx = (await getDB()).transaction('foodEntries', 'readwrite');
  const current = await tx.store.get(id);
  if (!current) throw new ValidationError('That entry no longer exists.');
  const updated: FoodEntry = {
    ...current,
    amount: parseAmount(input.amount, current.amountUnit),
    ...parseMacros(input.totals),
  };
  await tx.store.put(updated);
  await tx.done;
  return updated;
}

export async function deleteFoodEntry(id: string): Promise<void> {
  await (await getDB()).delete('foodEntries', id);
}
