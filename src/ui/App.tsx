import type { ComponentChildren } from 'preact';
import { useEffect } from 'preact/hooks';
import { getActiveWorkout } from '../db/workouts';
import { match, navigate, useRoute } from '../router';
import { BottomNav, type Tab } from './components/BottomNav';
import { Placeholder } from './screens/Placeholder';
import { Settings } from './screens/Settings';
import { TrainHome } from './screens/TrainHome';
import { Exercises } from './screens/Exercises';
import { Routines } from './screens/Routines';
import { RoutineEditor } from './screens/RoutineEditor';
import { StartWorkout } from './screens/StartWorkout';
import { WorkoutScreen } from './screens/WorkoutScreen';

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
  { pattern: '/train/workout/:id', render: (p) => <WorkoutScreen id={p.id} /> },
  { pattern: '/body', render: () => <Placeholder title="Body" note="Body measurements come in step 8." /> },
  { pattern: '/food', render: () => <Placeholder title="Food" note="Macro goals and food logging come in steps 9–10." /> },
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
