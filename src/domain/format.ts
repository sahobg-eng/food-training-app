import type { DateStr } from '../db/types';
import { parseDateStr } from './dates';

/** 100 -> "100", 102.5 -> "102.5", 12.25 -> "12.25". */
export function formatKg(n: number): string {
  return String(Math.round(n * 100) / 100);
}

/** Seconds -> "45:07" or "1:02:07". */
export function formatDuration(totalSec: number): string {
  const s = Math.max(0, Math.floor(totalSec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = String(m).padStart(h ? 2 : 1, '0');
  const ss = String(sec).padStart(2, '0');
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * '2026-11-14' -> "Sat 14 Nov", with the year added when it isn't `currentYear`.
 * Built by hand (not Intl) so it reads the same on every phone and locale.
 */
export function formatDay(date: DateStr, currentYear = new Date().getFullYear()): string {
  const d = parseDateStr(date);
  const base = `${WEEKDAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
  return d.getFullYear() === currentYear ? base : `${base} ${d.getFullYear()}`;
}

/** One set as "100 × 5", or "BW × 12" for bodyweight. */
export function formatSet(s: { weightKg: number; reps: number }): string {
  return `${s.weightKg === 0 ? 'BW' : formatKg(s.weightKg)} × ${s.reps}`;
}

/** Signed change with the unit's precision: "+0.4", "−0.6", "±0". */
export function formatChange(delta: number): string {
  const r = Math.round(delta * 100) / 100;
  if (r === 0) return '±0';
  return (r > 0 ? '+' : '−') + String(Math.abs(r));
}
