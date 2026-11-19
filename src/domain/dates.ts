import type { DateStr } from '../db/types';

const pad = (n: number) => String(n).padStart(2, '0');

/** Local calendar day for an instant, as 'YYYY-MM-DD'. Never uses UTC. */
export function toDateStr(d: Date | number = new Date()): DateStr {
  const x = typeof d === 'number' ? new Date(d) : d;
  return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}`;
}

/** Parse 'YYYY-MM-DD' as local midnight. */
export function parseDateStr(s: DateStr): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) throw new Error(`Invalid date string: ${s}`);
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  if (toDateStr(d) !== s) throw new Error(`Invalid date: ${s}`);
  return d;
}

/** Weekday with Monday = 0 ... Sunday = 6 (the app's convention). */
export function weekday(s: DateStr): number {
  return (parseDateStr(s).getDay() + 6) % 7;
}

/** Add whole calendar days (DST-safe because it works on local dates). */
export function addDays(s: DateStr, days: number): DateStr {
  const d = parseDateStr(s);
  d.setDate(d.getDate() + days);
  return toDateStr(d);
}

/** Local clock time of an instant as 'HH:MM'. */
export function toTimeStr(ms: number): string {
  const d = new Date(ms);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Instant for a local date and 'HH:MM' time. */
export function atLocalTime(date: DateStr, time: string): number {
  const m = /^(\d{1,2}):(\d{2})$/.exec(time.trim());
  if (!m || Number(m[1]) > 23 || Number(m[2]) > 59) throw new Error(`Invalid time: ${time}`);
  const d = parseDateStr(date);
  d.setHours(Number(m[1]), Number(m[2]), 0, 0);
  return d.getTime();
}
