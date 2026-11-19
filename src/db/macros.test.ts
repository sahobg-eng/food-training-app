import { beforeEach, describe, expect, it } from 'vitest';
import { getDB, useFreshDBForTests } from './schema';
import { getDayPlan, getMacroSettings, parseMacroValues, setDayType, setSchedule, setTarget } from './macros';

beforeEach(() => useFreshDBForTests(`mac-${Math.random()}`));

const v = (kcal: number, p = 150, c = 250, f = 70) => ({ kcal, proteinG: p, carbsG: c, fatG: f });

describe('macro targets', () => {
  it('parses inputs with comma decimals and rejects bad values', () => {
    expect(parseMacroValues({ kcal: '2500', proteinG: '180,5', carbsG: '250', fatG: '70' })).toEqual({
      kcal: 2500, proteinG: 180.5, carbsG: 250, fatG: 70,
    });
    expect(() => parseMacroValues({ kcal: '', proteinG: 1, carbsG: 1, fatG: 1 })).toThrow('Calories');
    expect(() => parseMacroValues({ kcal: 2000, proteinG: '-1', carbsG: 1, fatG: 1 })).toThrow('Protein');
    expect(() => parseMacroValues({ kcal: 20000, proteinG: 1, carbsG: 1, fatG: 1 })).toThrow('Calories');
  });

  it('versions changes by day so past days keep their target', async () => {
    await setTarget('workout', v(2800), '2026-11-01');
    await setTarget('workout', v(2700), '2026-11-01'); // same day: updates in place
    await setTarget('workout', v(2600), '2026-11-15'); // later: new version
    await setTarget('workout', v(2600), '2026-11-18'); // unchanged: no new version
    const { targets } = await getMacroSettings();
    expect(targets.map((t) => [t.effectiveFrom, t.kcal]).sort()).toEqual([['2026-11-01', 2700], ['2026-11-15', 2600]]);

    await setSchedule([0, 1, 2, 3, 4, 5, 6], '2026-11-01');
    expect((await getDayPlan('2026-11-10')).target?.kcal).toBe(2700);
    expect((await getDayPlan('2026-11-19')).target?.kcal).toBe(2600);
  });
});

describe('schedule and day overrides', () => {
  it('versions the schedule and gives each day its type and target', async () => {
    await setTarget('workout', v(2800), '2026-11-01');
    await setTarget('rest', v(2200), '2026-11-01');
    await setSchedule([0, 2, 4], '2026-11-01'); // Mon Wed Fri
    await setSchedule([1, 3], '2026-11-16'); // Tue Thu from Mon 16th

    expect(await getDayPlan('2026-11-11')).toMatchObject({ dayType: 'workout', isOverride: false, target: { kcal: 2800 } }); // Wed
    expect(await getDayPlan('2026-11-18')).toMatchObject({ dayType: 'rest', target: { kcal: 2200 } }); // Wed, new schedule
    expect((await getDayPlan('2026-11-19')).dayType).toBe('workout'); // Thu
  });

  it('switches a single day, and switching back removes the override', async () => {
    await setSchedule([3], '2026-11-01'); // Thursdays
    await setDayType('2026-11-19', 'rest');
    expect(await getDayPlan('2026-11-19')).toMatchObject({ dayType: 'rest', scheduledType: 'workout', isOverride: true });
    await setDayType('2026-11-19', 'workout');
    expect(await getDayPlan('2026-11-19')).toMatchObject({ dayType: 'workout', isOverride: false });
    expect(await (await getDB()).count('dayOverrides')).toBe(0);
  });

  it('has no target and rest days before anything is set up', async () => {
    expect(await getDayPlan('2026-11-19')).toMatchObject({ dayType: 'rest', target: null });
  });

  it('rejects invalid weekdays', async () => {
    await expect(setSchedule([7])).rejects.toThrow('Invalid weekday');
  });
});
