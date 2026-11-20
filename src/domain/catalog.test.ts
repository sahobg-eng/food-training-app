import { describe, expect, it } from 'vitest';
import { formatMuscles, loadCatalog, searchCatalog, type CatalogEntry } from './catalog';
import { MUSCLES } from '../db/types';

const c = (n: string): CatalogEntry => ({ id: n, n, p: ['chest'], s: [], e: null });
const cat = [c('Barbell Bench Press - Medium Grip'), c('Bench Press - Powerlifting'), c('Dumbbell Bench Press'), c('Squat'), c('Bench Dips')];

describe('exercise library', () => {
  it('matches every word: everyday lifts first, specialty variants last', () => {
    expect(searchCatalog(cat, 'bench press').map((e) => e.n)).toEqual([
      'Barbell Bench Press - Medium Grip',
      'Dumbbell Bench Press',
      'Bench Press - Powerlifting',
    ]);
    expect(searchCatalog(cat, 'press bench dumbbell').map((e) => e.n)).toEqual(['Dumbbell Bench Press']);
    expect(searchCatalog(cat, 'b')).toEqual([]);
  });
  it('leaves out names already in the library and respects the limit', () => {
    expect(searchCatalog(cat, 'bench', 6, ['dumbbell bench press']).map((e) => e.n)).not.toContain('Dumbbell Bench Press');
    expect(searchCatalog(cat, 'bench', 2)).toHaveLength(2);
  });
  it('formats muscles', () => {
    expect(formatMuscles(['chest'], ['shoulders', 'triceps'])).toBe('Chest · shoulders, triceps');
    expect(formatMuscles(['quadriceps', 'glutes'])).toBe('Quadriceps, Glutes');
    expect(formatMuscles()).toBe('');
  });
  it('ships a valid built-in library', async () => {
    const all = await loadCatalog();
    expect(all.length).toBeGreaterThan(800);
    const valid = new Set<string>(MUSCLES);
    for (const e of all) {
      expect(e.n.length).toBeGreaterThan(0);
      expect(e.p.length).toBeGreaterThan(0);
      expect([...e.p, ...e.s].every((m) => valid.has(m))).toBe(true);
    }
    expect(new Set(all.map((e) => e.n.toLowerCase())).size).toBe(all.length);
    expect(searchCatalog(all, 'barbell bench press medium')[0]).toMatchObject({ p: ['chest'], s: ['shoulders', 'triceps'] });
  });

  it('puts the everyday lift first for common searches, including nicknames', async () => {
    const all = await loadCatalog();
    const top = (q: string) => searchCatalog(all, q)[0]?.n;
    expect(top('bench press')).toBe('Barbell Bench Press - Medium Grip');
    expect(top('squat')).toBe('Barbell Squat');
    expect(top('deadlift')).toBe('Barbell Deadlift');
    expect(top('pull up')).toBe('Pullups');
    expect(top('overhead press')).toBe('Standing Military Press');
    expect(top('OHP')).toBe('Standing Military Press');
    expect(top('rdl')).toBe('Romanian Deadlift');
    expect(top('lat pulldown')).toBe('Wide-Grip Lat Pulldown');
    expect(top('leg press')).toBe('Leg Press');
  });
});
