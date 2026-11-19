import { openDB, type DBSchema, type IDBPDatabase, type IDBPTransaction, type StoreNames } from 'idb';
import type {
  DateStr,
  DayOverride,
  DayType,
  Exercise,
  Food,
  FoodEntry,
  MacroTarget,
  MeasurementEntry,
  MeasurementType,
  MetaKey,
  MetaRecord,
  Routine,
  ScheduleVersion,
  Workout,
  WorkoutSet,
} from './types';
import { newId } from './id';

export const DB_NAME = 'food-training';
/** Bump this and add a migration below for every schema change. */
export const SCHEMA_VERSION = 1;

export interface AppDB extends DBSchema {
  exercises: { key: string; value: Exercise; indexes: { name: string } };
  routines: { key: string; value: Routine };
  workouts: {
    key: string;
    value: Workout;
    // endedAt is null while in progress; IndexedDB leaves those rows out of the index.
    indexes: { date: DateStr; startedAt: number; endedAt: number };
  };
  sets: {
    key: string;
    value: WorkoutSet;
    indexes: { workoutId: string; exerciseId_date: [string, DateStr] };
  };
  measurementTypes: { key: string; value: MeasurementType };
  measurementEntries: {
    key: string;
    value: MeasurementEntry;
    indexes: { typeId_date: [string, DateStr]; date: DateStr };
  };
  macroTargets: {
    key: string;
    value: MacroTarget;
    indexes: { dayType_effectiveFrom: [DayType, DateStr] };
  };
  scheduleVersions: { key: string; value: ScheduleVersion; indexes: { effectiveFrom: DateStr } };
  dayOverrides: { key: DateStr; value: DayOverride };
  foods: { key: string; value: Food; indexes: { name: string; lastUsedAt: number } };
  foodEntries: { key: string; value: FoodEntry; indexes: { date: DateStr; foodId: string } };
  meta: { key: MetaKey; value: MetaRecord };
}

export type StoreName = StoreNames<AppDB>;

/** Every store, in a stable order. Export/import iterates over this. */
export const STORE_NAMES: StoreName[] = [
  'exercises',
  'routines',
  'workouts',
  'sets',
  'measurementTypes',
  'measurementEntries',
  'macroTargets',
  'scheduleVersions',
  'dayOverrides',
  'foods',
  'foodEntries',
  'meta',
];

type UpgradeTx = IDBPTransaction<AppDB, StoreName[], 'versionchange'>;
type Migration = (db: IDBPDatabase<AppDB>, tx: UpgradeTx) => void;

/** migrations[n] upgrades a database from version n to n + 1. */
const migrations: Migration[] = [
  // 0 -> 1: initial schema + seed data
  (db, tx) => {
    const exercises = db.createObjectStore('exercises', { keyPath: 'id' });
    exercises.createIndex('name', 'name');

    db.createObjectStore('routines', { keyPath: 'id' });

    const workouts = db.createObjectStore('workouts', { keyPath: 'id' });
    workouts.createIndex('date', 'date');
    workouts.createIndex('startedAt', 'startedAt');
    workouts.createIndex('endedAt', 'endedAt');

    const sets = db.createObjectStore('sets', { keyPath: 'id' });
    sets.createIndex('workoutId', 'workoutId');
    sets.createIndex('exerciseId_date', ['exerciseId', 'date']);

    db.createObjectStore('measurementTypes', { keyPath: 'id' });

    const mEntries = db.createObjectStore('measurementEntries', { keyPath: 'id' });
    mEntries.createIndex('typeId_date', ['typeId', 'date']);
    mEntries.createIndex('date', 'date');

    const targets = db.createObjectStore('macroTargets', { keyPath: 'id' });
    targets.createIndex('dayType_effectiveFrom', ['dayType', 'effectiveFrom']);

    const schedule = db.createObjectStore('scheduleVersions', { keyPath: 'id' });
    schedule.createIndex('effectiveFrom', 'effectiveFrom');

    db.createObjectStore('dayOverrides', { keyPath: 'date' });

    const foods = db.createObjectStore('foods', { keyPath: 'id' });
    foods.createIndex('name', 'name');
    foods.createIndex('lastUsedAt', 'lastUsedAt');

    const fEntries = db.createObjectStore('foodEntries', { keyPath: 'id' });
    fEntries.createIndex('date', 'date');
    fEntries.createIndex('foodId', 'foodId');

    db.createObjectStore('meta', { keyPath: 'key' });

    const now = Date.now();
    void tx.objectStore('measurementTypes').add({
      id: newId(),
      name: 'Body weight',
      unit: 'kg',
      archived: false,
      isDefault: true,
      createdAt: now,
    });
    void tx.objectStore('meta').put({ key: 'seededAt', value: now });
  },
];

if (migrations.length !== SCHEMA_VERSION) {
  throw new Error(`SCHEMA_VERSION is ${SCHEMA_VERSION} but there are ${migrations.length} migrations`);
}

/** Open (and create or migrate) the database. Use `getDB()` in app code. */
export function openAppDB(name = DB_NAME): Promise<IDBPDatabase<AppDB>> {
  return openDB<AppDB>(name, SCHEMA_VERSION, {
    upgrade(db, oldVersion, _newVersion, tx) {
      for (let v = oldVersion; v < SCHEMA_VERSION; v++) migrations[v](db, tx);
      void tx.objectStore('meta').put({ key: 'schemaVersion', value: SCHEMA_VERSION });
    },
    blocking() {
      // A newer version of the app (e.g. after an update) wants to upgrade the schema.
      // Close and reload so this tab picks up the new code instead of blocking it.
      dbPromise?.then((db) => db.close());
      dbPromise = null;
      if (typeof location !== 'undefined') location.reload();
    },
  });
}

let dbPromise: Promise<IDBPDatabase<AppDB>> | null = null;

/** The app's shared database connection. */
export function getDB(): Promise<IDBPDatabase<AppDB>> {
  if (!dbPromise) {
    dbPromise = openAppDB();
    dbPromise.catch(() => (dbPromise = null));
  }
  return dbPromise;
}
