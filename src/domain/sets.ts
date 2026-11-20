import { formatKg } from './format';

export interface SetValues {
  weightKg: number;
  reps: number;
}

/** Text values for one not-yet-recorded set row. */
export interface PendingRow {
  key: number;
  weight: string;
  reps: string;
}

let nextKey = 1;
const row = (v: SetValues | null): PendingRow => ({
  key: nextKey++,
  weight: v ? formatKg(v.weightKg) : '',
  reps: v ? String(v.reps) : '',
});

/**
 * Rows still to record for an exercise in a live workout: one per set from last time that
 * hasn't been done yet, prefilled with that set's values. A first-time exercise with
 * nothing logged gets one empty row.
 */
export function initialPendingRows(loggedCount: number, previous: SetValues[] | null): PendingRow[] {
  const prev = previous ?? [];
  if (prev.length > loggedCount) return prev.slice(loggedCount).map(row);
  return loggedCount === 0 ? [row(null)] : [];
}

/** A new extra row, prefilled from the last row shown (recorded or not). */
export function extraRow(last: SetValues | { weight: string; reps: string } | null): PendingRow {
  if (!last) return row(null);
  if ('weight' in last) return { key: nextKey++, weight: last.weight, reps: last.reps };
  return row(last);
}
