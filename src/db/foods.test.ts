import { beforeEach, describe, expect, it } from 'vitest';
import { useFreshDBForTests } from './schema';
import {
  createFood,
  deleteFoodEntry,
  entriesForDate,
  getFood,
  listFoods,
  logFood,
  logManualEntry,
  recentFoods,
  setFoodArchived,
  setFoodFavourite,
  updateFood,
  updateFoodEntry,
} from './foods';
import { addDays, toDateStr } from '../domain/dates';

beforeEach(() => useFreshDBForTests(`food-${Math.random()}`));

const chickenInput = { name: 'Chicken breast', basis: 'per100g' as const, macros: { kcal: 165, proteinG: 31, carbsG: 0, fatG: 3.6 } };
const D = '2026-11-19';

describe('foods', () => {
  it('creates foods with unique names and sanity-checks per-100 g macros', async () => {
    await createFood(chickenInput);
    await expect(createFood({ ...chickenInput, name: 'chicken BREAST' })).rejects.toThrow('already in your foods');
    await expect(
      createFood({ name: 'Typo', basis: 'per100g', macros: { kcal: 500, proteinG: 80, carbsG: 30, fatG: 10 } }),
    ).rejects.toThrow('more than 100 g');
    // Per serving can exceed 100 g of macros.
    await createFood({ name: 'Big meal', basis: 'perServing', servingLabel: ' plate ', macros: { kcal: 1200, proteinG: 80, carbsG: 120, fatG: 40 } });
    expect((await listFoods()).map((f) => [f.name, f.servingLabel])).toEqual([['Big meal', 'plate'], ['Chicken breast', null]]);
  });

  it('logs a saved food by amount and remembers it for one-tap re-entry', async () => {
    const f = await createFood(chickenInput);
    const e = await logFood(D, f.id, '150');
    expect(e).toMatchObject({ name: 'Chicken breast', amount: 150, amountUnit: 'g', kcal: 247.5, proteinG: 46.5, fatG: 5.4 });
    expect(await getFood(f.id)).toMatchObject({ lastAmount: 150 });
    expect((await recentFoods()).map((x) => x.id)).toEqual([f.id]);
    await expect(logFood(D, f.id, '0')).rejects.toThrow('Amount');
    await expect(logFood(addDays(toDateStr(), 1), f.id, 100)).rejects.toThrow('future');
  });

  it('logs a manual entry as entered and saves the food normalised', async () => {
    const { entry, food } = await logManualEntry(D, {
      name: 'Protein bar', amount: 2, unit: 'serving', servingLabel: 'bar',
      totals: { kcal: '400', proteinG: '40', carbsG: '44', fatG: '12' },
    });
    expect(entry).toMatchObject({ amount: 2, amountUnit: 'serving', servingLabel: 'bar', kcal: 400, proteinG: 40 });
    expect(food).toMatchObject({ basis: 'perServing', servingLabel: 'bar', kcal: 200, proteinG: 20, lastAmount: 2 });
    const m = await logManualEntry(D, { name: 'Rice', amount: '250', unit: 'g', totals: { kcal: 325, proteinG: 6.8, carbsG: 70, fatG: 0.8 } });
    expect(m.food).toMatchObject({ basis: 'per100g', kcal: 130, proteinG: 2.7, carbsG: 28, fatG: 0.3 });
    await expect(
      logManualEntry(D, { name: 'rice', amount: 100, unit: 'g', totals: { kcal: 1, proteinG: 1, carbsG: 1, fatG: 1 } }),
    ).rejects.toThrow('already in your foods');
  });

  it('editing a food never changes past entries', async () => {
    const f = await createFood(chickenInput);
    await logFood(D, f.id, 100);
    await updateFood(f.id, { ...chickenInput, name: 'Chicken (skinless)', macros: { kcal: 120, proteinG: 25, carbsG: 0, fatG: 2 } });
    expect((await entriesForDate(D))[0]).toMatchObject({ name: 'Chicken breast', kcal: 165 });
  });

  it('changing a food basis forgets the last amount', async () => {
    const f = await createFood(chickenInput);
    await logFood(D, f.id, 150);
    const u = await updateFood(f.id, { ...chickenInput, basis: 'perServing', servingLabel: 'fillet' });
    expect(u.lastAmount).toBeNull();
  });

  it('favourites and archives', async () => {
    const f = await createFood(chickenInput);
    await logFood(D, f.id, 100);
    await setFoodFavourite(f.id, true);
    expect((await getFood(f.id))?.favourite).toBe(true);
    await setFoodArchived(f.id, true);
    expect(await listFoods()).toEqual([]);
    expect(await recentFoods()).toEqual([]);
    expect(await entriesForDate(D)).toHaveLength(1);
  });

  it('lists entries per day in logging order, edits and deletes them', async () => {
    const f = await createFood(chickenInput);
    const a = await logFood(D, f.id, 100);
    const b = await logFood(D, f.id, 200);
    await logFood('2026-11-18', f.id, 50);
    expect((await entriesForDate(D)).map((e) => e.id)).toEqual([a.id, b.id]);
    const u = await updateFoodEntry(a.id, { amount: '120', totals: { kcal: 198, proteinG: 37.2, carbsG: 0, fatG: 4.3 } });
    expect(u).toMatchObject({ amount: 120, kcal: 198, name: 'Chicken breast' });
    await deleteFoodEntry(b.id);
    expect((await entriesForDate(D)).map((e) => e.amount)).toEqual([120]);
  });
});
