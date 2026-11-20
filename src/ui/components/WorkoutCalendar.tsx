import { useEffect, useState } from 'preact/hooks';
import type { DateStr, Workout } from '../../db/types';
import { finishedWorkoutsByDate } from '../../db/workouts';
import { monthGrid, monthRange, parseDateStr, toDateStr, toTimeStr } from '../../domain/dates';
import { formatDay, formatDuration } from '../../domain/format';
import { WEEKDAY_LABELS } from '../../domain/macros';
import { navigate } from '../../router';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/**
 * Month calendar with the days that have a finished workout marked. Tapping such a day
 * opens its workout, or lists them when there were several that day.
 */
export function WorkoutCalendar() {
  const today = toDateStr();
  const now = parseDateStr(today);
  const [ym, setYm] = useState({ year: now.getFullYear(), month: now.getMonth() });
  const [byDate, setByDate] = useState<Map<DateStr, Workout[]>>(new Map());
  const [selected, setSelected] = useState<DateStr | null>(null);

  useEffect(() => {
    const { first, last } = monthRange(ym.year, ym.month);
    setSelected(null);
    void finishedWorkoutsByDate(first, last).then(setByDate);
  }, [ym.year, ym.month]);

  const isCurrentMonth = ym.year === now.getFullYear() && ym.month === now.getMonth();
  const shift = (delta: number) =>
    setYm(({ year, month }) => {
      const d = new Date(year, month + delta, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });

  const count = [...byDate.values()].reduce((n, ws) => n + ws.length, 0);

  function onDay(date: DateStr) {
    const ws = byDate.get(date);
    if (!ws) return;
    if (ws.length === 1) navigate(`/train/workout/${ws[0].id}`);
    else setSelected(selected === date ? null : date);
  }

  const selectedWorkouts = selected ? (byDate.get(selected) ?? []) : [];

  return (
    <section class="calendar card" aria-label="Workout calendar">
      <div class="cal-head">
        <button type="button" class="icon-btn" aria-label="Previous month" onClick={() => shift(-1)}>
          ‹
        </button>
        <div class="grow center">
          <strong>
            {MONTHS[ym.month]} {ym.year}
          </strong>
          <div class="muted small">
            {count} {count === 1 ? 'workout' : 'workouts'}
          </div>
        </div>
        <button type="button" class="icon-btn" aria-label="Next month" disabled={isCurrentMonth} onClick={() => shift(1)}>
          ›
        </button>
      </div>

      <div class="cal-grid" role="grid">
        {WEEKDAY_LABELS.map((l) => (
          <span key={l} class="cal-wd" role="columnheader">
            {l[0]}
          </span>
        ))}
        {monthGrid(ym.year, ym.month)
          .flat()
          .map((date, i) => {
            if (!date) return <span key={`pad-${i}`} class="cal-pad" />;
            const ws = byDate.get(date);
            const day = Number(date.slice(8));
            const cls = ['cal-day', ws && 'has', date === today && 'today', date === selected && 'sel', date > today && 'future']
              .filter(Boolean)
              .join(' ');
            return (
              <button
                key={date}
                type="button"
                role="gridcell"
                class={cls}
                disabled={!ws}
                aria-label={`${formatDay(date)}${ws ? `, ${ws.length} ${ws.length === 1 ? 'workout' : 'workouts'}` : ''}`}
                onClick={() => onDay(date)}
              >
                <span>{day}</span>
                {ws && <span class="cal-dot">{ws.length > 1 ? ws.length : ''}</span>}
              </button>
            );
          })}
      </div>

      {selected && (
        <ul class="list cal-list">
          {selectedWorkouts.map((w) => (
            <li key={w.id}>
              <a class="list-item history-item" href={`#/train/workout/${w.id}`}>
                <span class="row">
                  <strong class="grow">{w.routineName ?? 'Workout'}</strong>
                  <span class="muted small">{formatDuration(w.durationSec ?? 0)}</span>
                </span>
                <span class="muted small">
                  {formatDay(w.date)} · {toTimeStr(w.startedAt)} · {w.exercises.length}{' '}
                  {w.exercises.length === 1 ? 'exercise' : 'exercises'}
                </span>
              </a>
            </li>
          ))}
        </ul>
      )}

      <a class="cal-all" href="#/train/history">
        All workouts ›
      </a>
    </section>
  );
}
