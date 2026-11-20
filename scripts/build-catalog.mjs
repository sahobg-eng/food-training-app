// Builds src/data/exercise-catalog.json from free-exercise-db (public domain, Unlicense):
// https://github.com/yuhonas/free-exercise-db  (dist/exercises.json)
//
// Usage: node scripts/build-catalog.mjs <path to downloaded exercises.json>
// Keeps only what the app uses: name, primary/secondary muscles, equipment.
import { readFileSync, writeFileSync } from 'node:fs';

const MUSCLES = new Set([
  'abdominals', 'abductors', 'adductors', 'biceps', 'calves', 'chest', 'forearms', 'glutes', 'hamstrings',
  'lats', 'lower back', 'middle back', 'neck', 'quadriceps', 'shoulders', 'traps', 'triceps',
]);

const src = process.argv[2];
if (!src) throw new Error('Pass the path to exercises.json');
const raw = JSON.parse(readFileSync(src, 'utf8'));
if (!Array.isArray(raw)) throw new Error('Expected an array');

const str = (v) => (typeof v === 'string' ? v.trim() : '');
const muscles = (v) => (Array.isArray(v) ? [...new Set(v.map(str).filter((m) => MUSCLES.has(m)))] : []);

const seen = new Set();
const out = [];
for (const e of raw) {
  const name = str(e?.name).replace(/\s+/g, ' ').slice(0, 60);
  const key = name.toLowerCase();
  if (!name || seen.has(key)) continue;
  const p = muscles(e.primaryMuscles);
  if (p.length === 0) continue;
  seen.add(key);
  out.push({ id: str(e.id), n: name, p, s: muscles(e.secondaryMuscles).filter((m) => !p.includes(m)), e: str(e.equipment) || null });
}
out.sort((a, b) => a.n.localeCompare(b.n));
writeFileSync('src/data/exercise-catalog.json', JSON.stringify(out));
console.log(`${out.length} exercises written (${raw.length - out.length} skipped)`);
