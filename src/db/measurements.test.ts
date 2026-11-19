import { beforeEach, describe, expect, it } from 'vitest';
import { useFreshDBForTests } from './schema';
import {
  addMeasurementType,
  deleteEntry,
  latestValues,
  listEntries,
  listMeasurementTypes,
  logMeasurements,
  parseMeasurement,
  renameMeasurementType,
  setMeasurementTypeArchived,
  updateEntry,
} from './measurements';
import { addDays, toDateStr } from '../domain/dates';

beforeEach(() => useFreshDBForTests(`ms-${Math.random()}`));

const bodyWeight = async () => (await listMeasurementTypes())[0];

describe('measurement types', () => {
  it('starts with body weight, sorts it first, and adds unique types', async () => {
    await addMeasurementType('Waist', 'cm');
    await addMeasurementType('arm', 'cm');
    expect((await listMeasurementTypes()).map((t) => [t.name, t.unit])).toEqual([
      ['Body weight', 'kg'],
      ['arm', 'cm'],
      ['Waist', 'cm'],
    ]);
    await expect(addMeasurementType('waist', 'cm')).rejects.toThrow('already exists');
    await expect(addMeasurementType('Hips', 'inch' as never)).rejects.toThrow('kg or cm');
  });

  it('renames and archives, keeping entries', async () => {
    const t = await addMeasurementType('Waist', 'cm');
    await logMeasurements('2026-11-19', [{ typeId: t.id, value: '84' }]);
    await renameMeasurementType(t.id, 'Waist (navel)');
    await setMeasurementTypeArchived(t.id, true);
    expect((await listMeasurementTypes()).map((x) => x.name)).toEqual(['Body weight']);
    expect((await listMeasurementTypes({ includeArchived: true })).map((x) => x.name)).toContain('Waist (navel)');
    expect(await listEntries(t.id)).toHaveLength(1);
    await expect(addMeasurementType('waist (NAVEL)', 'cm')).rejects.toThrow('Unarchive');
  });
});

describe('measurement entries', () => {
  it('parses values with comma decimals and limits', () => {
    expect(parseMeasurement('82,45', 'kg')).toBe(82.45);
    expect(parseMeasurement('84', 'cm')).toBe(84);
    for (const bad of ['', '0', '-1', 'abc', '501']) expect(() => parseMeasurement(bad, 'kg')).toThrow();
    expect(() => parseMeasurement('301', 'cm')).toThrow();
  });

  it('logs several types at once, skipping empty fields, one value per type per day', async () => {
    const bw = await bodyWeight();
    const waist = await addMeasurementType('Waist', 'cm');
    const saved = await logMeasurements('2026-11-19', [
      { typeId: bw.id, value: '82,4' },
      { typeId: waist.id, value: '84' },
      { typeId: 'unused', value: '' },
    ]);
    expect(saved).toHaveLength(2);
    await logMeasurements('2026-11-19', [{ typeId: bw.id, value: '82.1' }]); // replaces
    expect((await listEntries(bw.id)).map((e) => [e.date, e.value])).toEqual([['2026-11-19', 82.1]]);
  });

  it('rejects nothing-to-save, bad values (naming the type) and future dates', async () => {
    const bw = await bodyWeight();
    await expect(logMeasurements('2026-11-19', [{ typeId: bw.id, value: ' ' }])).rejects.toThrow('at least one');
    await expect(logMeasurements('2026-11-19', [{ typeId: bw.id, value: '0' }])).rejects.toThrow('Body weight:');
    await expect(logMeasurements(addDays(toDateStr(), 1), [{ typeId: bw.id, value: 80 }])).rejects.toThrow('future');
    await expect(logMeasurements('2026-02-30', [{ typeId: bw.id, value: 80 }])).rejects.toThrow('valid date');
  });

  it('lists newest first, edits and deletes, refusing a date clash', async () => {
    const bw = await bodyWeight();
    await logMeasurements('2026-11-10', [{ typeId: bw.id, value: 83 }]);
    await logMeasurements('2026-11-19', [{ typeId: bw.id, value: 82 }]);
    await logMeasurements('2026-11-15', [{ typeId: bw.id, value: 82.5 }]);
    const list = await listEntries(bw.id);
    expect(list.map((e) => e.date)).toEqual(['2026-11-19', '2026-11-15', '2026-11-10']);

    await expect(updateEntry(list[1].id, { date: '2026-11-19', value: 82.5 })).rejects.toThrow('already');
    await updateEntry(list[1].id, { date: '2026-11-14', value: '82,6' });
    await deleteEntry(list[2].id);
    expect((await listEntries(bw.id)).map((e) => [e.date, e.value])).toEqual([
      ['2026-11-19', 82],
      ['2026-11-14', 82.6],
    ]);
  });

  it('gives the latest and previous value per type', async () => {
    const bw = await bodyWeight();
    const waist = await addMeasurementType('Waist', 'cm');
    await logMeasurements('2026-11-10', [{ typeId: bw.id, value: 83 }, { typeId: waist.id, value: 85 }]);
    await logMeasurements('2026-11-19', [{ typeId: bw.id, value: 82 }]);
    const latest = await latestValues();
    expect([latest.get(bw.id)?.latest.value, latest.get(bw.id)?.previous?.value]).toEqual([82, 83]);
    expect([latest.get(waist.id)?.latest.value, latest.get(waist.id)?.previous]).toEqual([85, null]);
  });
});
