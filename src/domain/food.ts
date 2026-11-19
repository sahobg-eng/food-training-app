import type { Food, FoodBasis, FoodEntry } from '../db/types';
import { formatKg } from './format';

export interface Macros {
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}

export const ZERO: Macros = { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 };

const round1 = (n: number) => Math.round(n * 10) / 10;

/** Round for storage: kcal and grams to one decimal. */
export function roundMacros(m: Macros): Macros {
  return { kcal: round1(m.kcal), proteinG: round1(m.proteinG), carbsG: round1(m.carbsG), fatG: round1(m.fatG) };
}

export function scaleMacros(m: Macros, factor: number): Macros {
  return roundMacros({
    kcal: m.kcal * factor,
    proteinG: m.proteinG * factor,
    carbsG: m.carbsG * factor,
    fatG: m.fatG * factor,
  });
}

export const unitForBasis = (basis: FoodBasis): 'g' | 'serving' => (basis === 'per100g' ? 'g' : 'serving');

/** Totals for eating `amount` of a food (grams for per-100 g foods, servings otherwise). */
export function macrosForAmount(food: Pick<Food, 'basis' | 'kcal' | 'proteinG' | 'carbsG' | 'fatG'>, amount: number): Macros {
  return scaleMacros(food, food.basis === 'per100g' ? amount / 100 : amount);
}

/** Per-basis values for a food from the totals of one manual entry. */
export function perBasisFromTotals(totals: Macros, amount: number, unit: 'g' | 'serving'): Macros {
  return scaleMacros(totals, unit === 'g' ? 100 / amount : 1 / amount);
}

export function sumMacros(entries: Macros[]): Macros {
  return roundMacros(
    entries.reduce(
      (t, e) => ({ kcal: t.kcal + e.kcal, proteinG: t.proteinG + e.proteinG, carbsG: t.carbsG + e.carbsG, fatG: t.fatG + e.fatG }),
      ZERO,
    ),
  );
}

/** "150 g", "1 bar", "2 × bar", "1 serving", "1.5 servings". */
export function formatAmount(e: Pick<FoodEntry, 'amount' | 'amountUnit' | 'servingLabel'>): string {
  if (e.amountUnit === 'g') return `${formatKg(e.amount)} g`;
  const label = e.servingLabel?.trim();
  if (label) return e.amount === 1 ? `1 ${label}` : `${formatKg(e.amount)} × ${label}`;
  return `${formatKg(e.amount)} ${e.amount === 1 ? 'serving' : 'servings'}`;
}

/** Short macro line: "165 kcal · P 31 · C 0 · F 3.6". */
export function formatMacros(m: Macros): string {
  return `${Math.round(m.kcal)} kcal · P ${formatKg(round1(m.proteinG))} · C ${formatKg(round1(m.carbsG))} · F ${formatKg(round1(m.fatG))}`;
}

/** What a food's numbers refer to: "per 100 g", "per bar", "per serving". */
export function basisLabel(f: Pick<Food, 'basis' | 'servingLabel'>): string {
  return f.basis === 'per100g' ? 'per 100 g' : `per ${f.servingLabel?.trim() || 'serving'}`;
}
