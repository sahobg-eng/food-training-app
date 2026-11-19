import { getDB } from './schema';
import { newId } from './id';
import type { DateStr, MeasurementEntry, MeasurementType, MeasurementUnit } from './types';
import { byName, cleanName, sameName, ValidationError } from './validation';
import { parseDateStr, toDateStr } from '../domain/dates';

export const UNITS: MeasurementUnit[] = ['kg', 'cm'];
const MAX_VALUE: Record<MeasurementUnit, number> = { kg: 500, cm: 300 };

/** Parse a measurement typed on a phone keyboard ("82,4" or "82.4"). Must be > 0. */
export function parseMeasurement(raw: string | number, unit: MeasurementUnit): number {
  const text = typeof raw === 'number' ? String(raw) : raw.trim().replace(',', '.');
  const n = Number(text);
  if (!text || !Number.isFinite(n) || n <= 0 || n > MAX_VALUE[unit])
    throw new ValidationError(`Enter a value between 0 and ${MAX_VALUE[unit]} ${unit}.`);
  return Math.round(n * 100) / 100;
}

function checkDate(date: DateStr, today = toDateStr()): DateStr {
  try {
    parseDateStr(date);
  } catch {
    throw new ValidationError('Enter a valid date.');
  }
  if (date > today) throw new ValidationError('The date cannot be in the future.');
  return date;
}

// ---------- Types ----------

/** Default type (body weight) first, then by name. */
const typeOrder = (a: MeasurementType, b: MeasurementType) =>
  Number(b.isDefault) - Number(a.isDefault) || byName(a, b);

export async function listMeasurementTypes(opts: { includeArchived?: boolean } = {}): Promise<MeasurementType[]> {
  const all = await (await getDB()).getAll('measurementTypes');
  return all.filter((t) => opts.includeArchived || !t.archived).sort(typeOrder);
}

export async function getMeasurementType(id: string): Promise<MeasurementType | undefined> {
  return (await getDB()).get('measurementTypes', id);
}

function assertUniqueType(all: MeasurementType[], name: string, exceptId?: string) {
  const clash = all.find((t) => t.id !== exceptId && sameName(t.name, name));
  if (!clash) return;
  throw new ValidationError(
    clash.archived ? `"${clash.name}" already exists in Archived. Unarchive it instead.` : `"${clash.name}" already exists.`,
  );
}

/** The unit is fixed at creation so existing history keeps its meaning. */
export async function addMeasurementType(rawName: string, unit: MeasurementUnit): Promise<MeasurementType> {
  const name = cleanName(rawName);
  if (!UNITS.includes(unit)) throw new ValidationError('Choose kg or cm.');
  const tx = (await getDB()).transaction('measurementTypes', 'readwrite');
  assertUniqueType(await tx.store.getAll(), name);
  const type: MeasurementType = { id: newId(), name, unit, archived: false, isDefault: false, createdAt: Date.now() };
  await tx.store.add(type);
  await tx.done;
  return type;
}

async function editType(id: string, fn: (t: MeasurementType, all: MeasurementType[]) => MeasurementType) {
  const tx = (await getDB()).transaction('measurementTypes', 'readwrite');
  const all = await tx.store.getAll();
  const current = all.find((t) => t.id === id);
  if (!current) throw new ValidationError('That measurement type no longer exists.');
  const updated = fn(current, all);
  await tx.store.put(updated);
  await tx.done;
  return updated;
}

export function renameMeasurementType(id: string, rawName: string): Promise<MeasurementType> {
  const name = cleanName(rawName);
  return editType(id, (t, all) => {
    assertUniqueType(all, name, id);
    return { ...t, name };
  });
}

/** Archived types are hidden from entry but keep their history. */
export function setMeasurementTypeArchived(id: string, archived: boolean): Promise<MeasurementType> {
  return editType(id, (t) => ({ ...t, archived }));
}

// ---------- Entries ----------

/**
 * Log one or more measurements for a date. There is one value per type per day:
 * logging a type again on the same date replaces that day's value.
 */
export async function logMeasurements(
  date: DateStr,
  values: { typeId: string; value: string | number }[],
): Promise<MeasurementEntry[]> {
  checkDate(date);
  const filled = values.filter((v) => String(v.value).trim() !== '');
  if (filled.length === 0) throw new ValidationError('Enter at least one value.');

  const tx = (await getDB()).transaction(['measurementTypes', 'measurementEntries'], 'readwrite');
  const entries = tx.objectStore('measurementEntries');
  const parsed: { type: MeasurementType; value: number }[] = [];
  for (const v of filled) {
    const type = await tx.objectStore('measurementTypes').get(v.typeId);
    if (!type) throw new ValidationError('A measurement type no longer exists.');
    try {
      parsed.push({ type, value: parseMeasurement(v.value, type.unit) });
    } catch (e) {
      throw new ValidationError(`${type.name}: ${(e as Error).message}`);
    }
  }
  const saved: MeasurementEntry[] = [];
  for (const { type, value } of parsed) {
    const existing = await entries.index('typeId_date').get([type.id, date]);
    const entry: MeasurementEntry = existing
      ? { ...existing, value }
      : { id: newId(), typeId: type.id, date, value, createdAt: Date.now() };
    await entries.put(entry);
    saved.push(entry);
  }
  await tx.done;
  return saved;
}

/** All entries of a type, newest first. */
export async function listEntries(typeId: string): Promise<MeasurementEntry[]> {
  const range = IDBKeyRange.bound([typeId, ''], [typeId, '￿']);
  const rows = await (await getDB()).getAllFromIndex('measurementEntries', 'typeId_date', range);
  return rows.reverse();
}

export async function updateEntry(id: string, input: { date: DateStr; value: string | number }): Promise<MeasurementEntry> {
  const date = checkDate(input.date);
  const tx = (await getDB()).transaction(['measurementTypes', 'measurementEntries'], 'readwrite');
  const entries = tx.objectStore('measurementEntries');
  const current = await entries.get(id);
  if (!current) throw new ValidationError('That entry no longer exists.');
  const type = await tx.objectStore('measurementTypes').get(current.typeId);
  if (!type) throw new ValidationError('Its measurement type no longer exists.');
  const value = parseMeasurement(input.value, type.unit);
  if (date !== current.date) {
    const clash = await entries.index('typeId_date').get([current.typeId, date]);
    if (clash) throw new ValidationError(`There is already a ${type.name.toLowerCase()} entry on that date.`);
  }
  const updated = { ...current, date, value };
  await entries.put(updated);
  await tx.done;
  return updated;
}

export async function deleteEntry(id: string): Promise<void> {
  await (await getDB()).delete('measurementEntries', id);
}

export interface LatestValue {
  latest: MeasurementEntry;
  previous: MeasurementEntry | null;
}

/** For each type: its newest entry and the one before it (for the change). */
export async function latestValues(): Promise<Map<string, LatestValue>> {
  const tx = (await getDB()).transaction('measurementEntries');
  const index = tx.store.index('typeId_date');
  const out = new Map<string, LatestValue>();
  // Walk newest first; entries are ordered by [typeId, date], so each type's rows are contiguous.
  let cursor = await index.openCursor(null, 'prev');
  while (cursor) {
    const e = cursor.value;
    const cur = out.get(e.typeId);
    if (!cur) out.set(e.typeId, { latest: e, previous: null });
    else if (!cur.previous) cur.previous = e;
    cursor = await cursor.continue();
  }
  return out;
}

/** Entries logged on one date, keyed by type id. */
export async function entriesOn(date: DateStr): Promise<Map<string, MeasurementEntry>> {
  const rows = await (await getDB()).getAllFromIndex('measurementEntries', 'date', date);
  return new Map(rows.map((e) => [e.typeId, e]));
}
