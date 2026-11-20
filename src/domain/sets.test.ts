import { describe, expect, it } from 'vitest';
import { extraRow, initialPendingRows } from './sets';

const prev = [
  { weightKg: 100, reps: 5 },
  { weightKg: 100, reps: 5 },
  { weightKg: 102.5, reps: 4 },
];
const vals = (rows: { weight: string; reps: string }[]) => rows.map((r) => [r.weight, r.reps]);

describe('pending set rows', () => {
  it('offers every set from last time, prefilled', () => {
    expect(vals(initialPendingRows(0, prev))).toEqual([['100', '5'], ['100', '5'], ['102.5', '4']]);
  });
  it('offers only the sets not done yet when resuming', () => {
    expect(vals(initialPendingRows(2, prev))).toEqual([['102.5', '4']]);
    expect(initialPendingRows(3, prev)).toEqual([]);
    expect(initialPendingRows(4, prev)).toEqual([]);
  });
  it('gives one empty row the first time, none once something is logged', () => {
    expect(vals(initialPendingRows(0, null))).toEqual([['', '']]);
    expect(vals(initialPendingRows(0, []))).toEqual([['', '']]);
    expect(initialPendingRows(1, null)).toEqual([]);
  });
  it('prefills an extra row from the last row, with unique keys', () => {
    const a = extraRow({ weightKg: 0, reps: 12 });
    const b = extraRow({ weight: '80', reps: '8' });
    expect([a.weight, a.reps, b.weight, b.reps]).toEqual(['0', '12', '80', '8']);
    expect(a.key).not.toBe(b.key);
    expect(vals([extraRow(null)])).toEqual([['', '']]);
  });
});
