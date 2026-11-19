import { getDB, SCHEMA_VERSION } from './schema';
import { requestPersistence, type PersistState } from './persist';

export interface StorageStatus {
  schemaVersion: number;
  persist: PersistState;
  measurementTypes: number;
  usageBytes: number | null;
}

let persistPromise: Promise<PersistState> | null = null;

/** Called once at startup: opens (creates/migrates) the DB and asks for persistent storage. */
export function initStorage(): Promise<PersistState> {
  void getDB();
  persistPromise ??= requestPersistence();
  return persistPromise;
}

export async function getStorageStatus(): Promise<StorageStatus> {
  const db = await getDB();
  const [persist, measurementTypes, estimate] = await Promise.all([
    initStorage(),
    db.count('measurementTypes'),
    navigator.storage?.estimate?.().catch(() => undefined),
  ]);
  return {
    schemaVersion: SCHEMA_VERSION,
    persist,
    measurementTypes,
    usageBytes: estimate?.usage ?? null,
  };
}
