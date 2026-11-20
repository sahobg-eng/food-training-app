import type { Muscle } from '../db/types';

/** One entry of the built-in exercise library (src/data/exercise-catalog.json). */
export interface CatalogEntry {
  id: string;
  n: string; // name
  p: Muscle[]; // primary muscles
  s: Muscle[]; // secondary muscles
  e: string | null; // equipment
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

/**
 * Everyday lifts, ranked first when they match what was typed, in this order (so the
 * classic barbell lift comes before its dumbbell or machine cousins).
 */
const STAPLES = new Map(
  [
    'Barbell Bench Press - Medium Grip', 'Barbell Squat', 'Barbell Deadlift', 'Standing Military Press', 'Pullups',
    'Bent Over Barbell Row', 'Barbell Curl', 'Wide-Grip Lat Pulldown', 'Dips - Triceps Version', 'Leg Press',
    'Romanian Deadlift', 'Barbell Incline Bench Press - Medium Grip', 'Dumbbell Bench Press', 'Incline Dumbbell Press',
    'Front Barbell Squat', 'Goblet Squat', 'Sumo Deadlift', 'Chin-Up', 'Seated Dumbbell Press', 'One-Arm Dumbbell Row',
    'Seated Cable Rows', 'Dumbbell Bicep Curl', 'Hammer Curls', 'Triceps Pushdown', 'Pushups', 'Lying Leg Curls',
    'Leg Extensions', 'Barbell Hip Thrust', 'Dumbbell Lunges', 'Standing Calf Raises', 'Side Lateral Raise',
    'Face Pull', 'Cable Crossover', 'Barbell Shrug', 'Hanging Leg Raise', 'Crunches', 'Plank',
  ].map((n, i) => [norm(n), i]),
);

/** Specialty variants (bands, chains, strongman…) rank below the plain lift. */
const VARIANT = /\b(with|band|bands|chains|powerlifting|plate movers|car|axle|rocky|sled|prowler|reverse band)\b/;

/** Common names that the library spells differently. */
const ALIASES: Record<string, string> = {
  ohp: 'military press',
  'overhead press': 'military press',
  'shoulder press': 'military press',
  rdl: 'romanian deadlift',
  'pull up': 'pullups',
  'pull ups': 'pullups',
  'chin up': 'chin up',
  'push up': 'pushups',
  'push ups': 'pushups',
  lunge: 'lunges',
  'calf raise': 'calf raises',
};

function score(name: string, q: string): number {
  const staple = STAPLES.get(name);
  if (staple !== undefined) return -10000 + staple;
  return (
    (name.startsWith(q) ? 0 : name.includes(q) ? 300 : 600) +
    (VARIANT.test(name) ? 400 : 0) +
    name.length
  );
}

/**
 * Library entries whose name contains every word typed, best first: everyday lifts, then
 * names starting with the query, then shorter names, with specialty variants last.
 * Entries named like `exclude` are left out.
 */
export function searchCatalog(catalog: CatalogEntry[], query: string, limit = 6, exclude: string[] = []): CatalogEntry[] {
  const q = norm(query);
  if (q.length < 2) return [];
  const queries = [q, ...(ALIASES[q] ? [ALIASES[q]] : [])];
  const skip = new Set(exclude.map(norm));
  const best = new Map<CatalogEntry, number>();
  for (const query of queries) {
    const words = query.split(' ');
    for (const e of catalog) {
      const name = norm(e.n);
      if (skip.has(name) || !words.every((w) => name.includes(w))) continue;
      const sc = score(name, query);
      if (!best.has(e) || sc < best.get(e)!) best.set(e, sc);
    }
  }
  return [...best].sort((a, b) => a[1] - b[1]).slice(0, limit).map(([e]) => e);
}

const cap = (m: string) => m.charAt(0).toUpperCase() + m.slice(1);

/** "Chest · shoulders, triceps" (primary, then secondary); empty string when none. */
export function formatMuscles(primary: Muscle[] = [], secondary: Muscle[] = []): string {
  if (!primary.length && !secondary.length) return '';
  const p = primary.map(cap).join(', ');
  return secondary.length ? `${p || '—'} · ${secondary.join(', ')}` : p;
}

let cache: Promise<CatalogEntry[]> | null = null;

/** Loads the library on first use (a separate file, so the app starts as fast as before). */
export function loadCatalog(): Promise<CatalogEntry[]> {
  cache ??= import('../data/exercise-catalog.json').then((m) => m.default as CatalogEntry[]);
  return cache;
}
