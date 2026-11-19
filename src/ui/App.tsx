import type { ComponentChildren } from 'preact';
import { useEffect } from 'preact/hooks';
import { getActiveWorkout } from '../db/workouts';
import { match, navigate, useRoute } from '../router';
import { BottomNav, type Tab } from './components/BottomNav';
import { Settings } from './screens/Settings';
import { TrainHome } from './screens/TrainHome';
import { Exercises } from './screens/Exercises';
import { Routines } from './screens/Routines';
import { RoutineEditor } from './screens/RoutineEditor';
import { StartWorkout } from './screens/StartWorkout';
import { WorkoutScreen } from './screens/WorkoutScreen';
import { History } from './screens/History';
import { Body } from './screens/Body';
import { MeasurementTypes } from './screens/MeasurementTypes';
import { MeasurementHistory } from './screens/MeasurementHistory';
import { FoodDay } from './screens/FoodDay';
import { Goals } from './screens/Goals';
import { AddFood } from './screens/AddFood';
import { FoodEditor, Foods } from './screens/Foods';

const TABS: Tab[] = [
  { path: '/train', label: 'Train' },
  { path: '/body', label: 'Body' },
  { path: '/food', label: 'Food' },
  { path: '/settings', label: 'Settings' },
];

type Route = { pattern: string; render: (params: Record<string, string>) => ComponentChildren };

const ROUTES: Route[] = [
  { pattern: '/train', render: () => <TrainHome /> },
  { pattern: '/train/exercises', render: () => <Exercises /> },
  { pattern: '/train/routines', render: () => <Routines /> },
  { pattern: '/train/routines/:id', render: (p) => <RoutineEditor id={p.id} /> },
  { pattern: '/train/start', render: () => <StartWorkout /> },
  { pattern: '/train/history', render: () => <History /> },
  { pattern: '/train/workout/:id', render: (p) => <WorkoutScreen id={p.id} /> },
  { pattern: '/body', render: () => <Body /> },
  { pattern: '/body/types', render: () => <MeasurementTypes /> },
  { pattern: '/body/type/:id', render: (p) => <MeasurementHistory id={p.id} /> },
  { pattern: '/food', render: () => <FoodDay /> },
  { pattern: '/food/day/:date', render: (p) => <FoodDay date={p.date} /> },
  { pattern: '/food/goals', render: () => <Goals /> },
  { pattern: '/food/add/:date', render: (p) => <AddFood date={p.date} /> },
  { pattern: '/food/foods', render: () => <Foods /> },
  { pattern: '/food/foods/:id', render: (p) => <FoodEditor id={p.id} /> },
  { pattern: '/settings', render: () => <Settings /> },
];

export function App() {
  const path = useRoute();

  // Opening the app (on its start page) with a workout in progress goes straight back to it.
  useEffect(() => {
    if (path !== '/' && path !== '/train') return;
    void getActiveWorkout().then((w) => w && navigate(`/train/workout/${w.id}`));
  }, []);
  const tab = TABS.find((t) => path === t.path || path.startsWith(t.path + '/')) ?? TABS[0];

  let screen: ComponentChildren = null;
  for (const r of ROUTES) {
    const params = match(r.pattern, path);
    if (params) {
      screen = r.render(params);
      break;
    }
  }
  screen ??= ROUTES[0].render({});

  return (
    <div class="app">
      <main class="screen">{screen}</main>
      <BottomNav tabs={TABS} active={tab.path} />
    </div>
  );
}
