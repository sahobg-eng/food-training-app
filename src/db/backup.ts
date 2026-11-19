import { getDB, SCHEMA_VERSION, STORE_NAMES, type StoreName } from './schema';
import { ValidationError } from './validation';
import { toDateStr } from '../domain/dates';

export const BACKUP_APP = 'food-training';

export interface Backup {
  app: typeof BACKUP_APP;
  schemaVersion: number;
  exportedAt: number;
  stores: Record<StoreName, unknown[]>;
}

/** The primary key field of each store. */
const KEY_PATH: Record<StoreName, string> = Object.fromEntries(
  STORE_NAMES.map((s) => [s, s === 'dayOverrides' ? 'date' : s === 'meta' ? 'key' : 'id']),
) as Record<StoreName, string>;

/** [singular, plural] labels for the import summary (meta is internal and not shown). */
export const STORE_LABELS: Partial<Record<StoreName, [string, string]>> = {
  workouts: ['workout', 'workouts'],
  sets: ['set', 'sets'],
  exercises: ['exercise', 'exercises'],
  routines: ['routine', 'routines'],
  measurementEntries: ['measurement', 'measurements'],
  measurementTypes: ['measurement type', 'measurement types'],
  foodEntries: ['food entry', 'food entries'],
  foods: ['food', 'foods'],
  macroTargets: ['macro target', 'macro targets'],
  scheduleVersions: ['weekly schedule', 'weekly schedules'],
  dayOverrides: ['day override', 'day overrides'],
};

export function backupFileName(at = Date.now()): string {
  return `food-training-backup-${toDateStr(at)}.json`;
}

/** Snapshot every store in one read transaction. */
export async function buildBackup(now = Date.now()): Promise<Backup> {
  const tx = (await getDB()).transaction(STORE_NAMES);
  const stores = {} as Record<StoreName, unknown[]>;
  for (const name of STORE_NAMES) stores[name] = await tx.objectStore(name).getAll();
  await tx.done;
  return { app: BACKUP_APP, schemaVersion: SCHEMA_VERSION, exportedAt: now, stores };
}

export function serializeBackup(b: Backup): string {
  return JSON.stringify(b);
}

export async function recordExport(at = Date.now()): Promise<void> {
  await (await getDB()).put('meta', { key: 'lastExportAt', value: at });
}

export async function getLastExportAt(): Promise<number | null> {
  const rec = await (await getDB()).get('meta', 'lastExportAt');
  return typeof rec?.value === 'number' ? rec.value : null;
}

/** Row counts per store, for summaries. */
export function countRows(b: Backup): Record<StoreName, number> {
  return Object.fromEntries(STORE_NAMES.map((s) => [s, b.stores[s].length])) as Record<StoreName, number>;
}

export async function countCurrentRows(): Promise<Record<StoreName, number>> {
  const tx = (await getDB()).transaction(STORE_NAMES);
  const out = {} as Record<StoreName, number>;
  for (const s of STORE_NAMES) out[s] = await tx.objectStore(s).count();
  return out;
}

/**
 * Upgrade an older backup to the current schema. migrations[n] turns a version n+1 backup
 * into version n+2; add one alongside every schema migration that changes record shapes.
 */
const backupMigrations: ((stores: Record<string, unknown[]>) => void)[] = [];

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** Parse and validate a backup file. Throws ValidationError with a message for the user. */
export function parseBackup(text: string): Backup {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new ValidationError('This file is not a backup (it is not valid JSON).');
  }
  if (!isObj(data) || data.app !== BACKUP_APP || !isObj(data.stores))
    throw new ValidationError('This file is not a Food & Training backup.');
  const version = data.schemaVersion;
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1)
    throw new ValidationError('This backup has no valid version number.');
  if (version > SCHEMA_VERSION)
    throw new ValidationError('This backup was made by a newer version of the app. Update the app and try again.');
  if (typeof data.exportedAt !== 'number') throw new ValidationError('This backup has no export date.');

  const stores = { ...data.stores } as Record<string, unknown[]>;
  for (const name of Object.keys(stores))
    if (!(STORE_NAMES as string[]).includes(name)) throw new ValidationError(`Unknown data in backup: "${name}".`);
  for (const name of STORE_NAMES) {
    stores[name] ??= []; // stores added in later versions may be missing from old backups
    if (!Array.isArray(stores[name])) throw new ValidationError(`Damaged backup: "${name}" is not a list.`);
  }
  for (let v = version; v < SCHEMA_VERSION; v++) backupMigrations[v - 1]?.(stores);

  for (const name of STORE_NAMES) {
    const key = KEY_PATH[name];
    const seen = new Set<unknown>();
    for (const row of stores[name]) {
      if (!isObj(row) || typeof row[key] !== 'string' || !row[key])
        throw new ValidationError(`Damaged backup: a record in "${name}" has no ${key}.`);
      if (seen.has(row[key])) throw new ValidationError(`Damaged backup: duplicate record in "${name}".`);
      seen.add(row[key]);
    }
  }

  return {
    app: BACKUP_APP,
    schemaVersion: SCHEMA_VERSION,
    exportedAt: data.exportedAt,
    stores: stores as Record<StoreName, unknown[]>,
  };
}

/**
 * Replace ALL data with the backup, in one transaction: if anything fails, nothing changes.
 * The backup counts as the latest export.
 */
export async function restoreBackup(b: Backup): Promise<void> {
  const tx = (await getDB()).transaction(STORE_NAMES, 'readwrite');
  try {
    for (const name of STORE_NAMES) {
      const store = tx.objectStore(name);
      await store.clear();
      // Records were validated by parseBackup; the store's key path enforces uniqueness.
      for (const row of b.stores[name]) await store.add(row as never);
    }
    const meta = tx.objectStore('meta');
    await meta.put({ key: 'schemaVersion', value: SCHEMA_VERSION });
    await meta.put({ key: 'lastExportAt', value: b.exportedAt });
    await tx.done;
  } catch (e) {
    try {
      tx.abort();
    } catch {
      // already aborted
    }
    await tx.done.catch(() => undefined);
    throw e instanceof ValidationError ? e : new ValidationError('The backup could not be restored. Your data was not changed.');
  }
}
