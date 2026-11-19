import { useEffect, useState } from 'preact/hooks';
import { getDayPlan, setDayType, type DayPlan } from '../../db/macros';
import { addDays, toDateStr } from '../../domain/dates';
import { formatDay, formatKg } from '../../domain/format';
import { navigate } from '../../router';
import { ScreenHeader } from '../components/ScreenHeader';

/** The Food tab for one day (today by default). Food logging arrives in step 10. */
export function FoodDay({ date: dateParam }: { date?: string }) {
  const today = toDateStr();
  const date = dateParam && dateParam <= today ? dateParam : today;
  const [plan, setPlan] = useState<DayPlan | null>(null);

  const reload = () => getDayPlan(date).then(setPlan);
  useEffect(() => {
    setPlan(null);
    void reload();
  }, [date]);

  const go = (d: string) => navigate(d === today ? '/food' : `/food/day/${d}`);
  const isToday = date === today;

  async function switchType() {
    if (!plan) return;
    await setDayType(date, plan.dayType === 'workout' ? 'rest' : 'workout');
    await reload();
  }

  return (
    <section>
      <ScreenHeader title="Food" />
      <div class="day-nav">
        <button type="button" class="icon-btn" aria-label="Previous day" onClick={() => go(addDays(date, -1))}>
          ‹
        </button>
        <strong class="grow center">{isToday ? `Today · ${formatDay(date)}` : formatDay(date)}</strong>
        <button type="button" class="icon-btn" aria-label="Next day" disabled={isToday} onClick={() => go(addDays(date, 1))}>
          ›
        </button>
      </div>
      {!isToday && (
        <button type="button" class="link" onClick={() => go(today)}>
          Back to today
        </button>
      )}

      {plan && (
        <>
          <div class="card day-type">
            <div class="row">
              <span class="grow">
                <strong>{plan.dayType === 'workout' ? 'Workout day' : 'Rest day'}</strong>
                {plan.isOverride && (
                  <span class="muted small">
                    <br />
                    Switched · schedule says {plan.scheduledType}
                  </span>
                )}
              </span>
              <button type="button" class="small-btn" onClick={switchType}>
                Make it a {plan.dayType === 'workout' ? 'rest' : 'workout'} day
              </button>
            </div>
          </div>

          {plan.target ? (
            <div class="targets">
              <div class="target kcal">
                <span class="muted small">Calories</span>
                <strong>{plan.target.kcal}</strong>
                <span class="muted small">kcal</span>
              </div>
              {(
                [
                  ['Protein', plan.target.proteinG],
                  ['Carbs', plan.target.carbsG],
                  ['Fat', plan.target.fatG],
                ] as const
              ).map(([label, g]) => (
                <div key={label} class="target">
                  <span class="muted small">{label}</span>
                  <strong>{formatKg(g)}</strong>
                  <span class="muted small">g</span>
                </div>
              ))}
            </div>
          ) : (
            <p class="muted">
              No {plan.dayType} day target yet. <a href="#/food/goals">Set your goals</a>.
            </p>
          )}
          <p class="muted small">Food logging comes in step 10.</p>
        </>
      )}

      <a class="menu-item manage-link" href="#/food/goals">
        <span>Goals and weekly schedule</span>
        <span>›</span>
      </a>
    </section>
  );
}
