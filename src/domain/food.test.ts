import { describe, expect, it } from 'vitest';
import { basisLabel, formatAmount, formatMacros, macrosForAmount, perBasisFromTotals, sumMacros } from './food';

const chicken = { basis: 'per100g' as const, kcal: 165, proteinG: 31, carbsG: 0, fatG: 3.6 };
const bar = { basis: 'perServing' as const, kcal: 200, proteinG: 20, carbsG: 22, fatG: 6 };

describe('food maths', () => {
  it('scales per-100 g and per-serving foods by amount', () => {
    expect(macrosForAmount(chicken, 150)).toEqual({ kcal: 247.5, proteinG: 46.5, carbsG: 0, fatG: 5.4 });
    expect(macrosForAmount(bar, 1.5)).toEqual({ kcal: 300, proteinG: 30, carbsG: 33, fatG: 9 });
  });
  it('derives per-basis values from a manual entry', () => {
    expect(perBasisFromTotals({ kcal: 330, proteinG: 62, carbsG: 0, fatG: 7.2 }, 200, 'g')).toEqual({
      kcal: 165, proteinG: 31, carbsG: 0, fatG: 3.6,
    });
    expect(perBasisFromTotals({ kcal: 400, proteinG: 40, carbsG: 44, fatG: 12 }, 2, 'serving')).toEqual({
      kcal: 200, proteinG: 20, carbsG: 22, fatG: 6,
    });
  });
  it('sums without float noise', () => {
    expect(sumMacros([{ kcal: 0.1, proteinG: 0.2, carbsG: 0, fatG: 0 }, { kcal: 0.2, proteinG: 0.1, carbsG: 0, fatG: 0 }])).toEqual({
      kcal: 0.3, proteinG: 0.3, carbsG: 0, fatG: 0,
    });
    expect(sumMacros([])).toEqual({ kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 });
  });
  it('formats amounts and macros', () => {
    expect(formatAmount({ amount: 150, amountUnit: 'g' })).toBe('150 g');
    expect(formatAmount({ amount: 1, amountUnit: 'serving', servingLabel: 'bar' })).toBe('1 bar');
    expect(formatAmount({ amount: 2, amountUnit: 'serving', servingLabel: 'bar' })).toBe('2 × bar');
    expect(formatAmount({ amount: 1.5, amountUnit: 'serving' })).toBe('1.5 servings');
    expect(formatMacros({ kcal: 247.5, proteinG: 46.5, carbsG: 0, fatG: 5.4 })).toBe('248 kcal · P 46.5 · C 0 · F 5.4');
    expect(basisLabel({ basis: 'perServing', servingLabel: 'bar' })).toBe('per bar');
    expect(basisLabel({ basis: 'per100g', servingLabel: null })).toBe('per 100 g');
  });
});
