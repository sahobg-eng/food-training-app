import type { ComponentChildren } from 'preact';
import { match, useRoute } from '../router';
import { BottomNav, type Tab } from './components/BottomNav';
import { Placeholder } from './screens/Placeholder';
import { Settings } from './screens/Settings';
import { TrainHome } from './screens/TrainHome';
import { Exercises } from './screens/Exercises';

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
  { pattern: '/body', render: () => <Placeholder title="Body" note="Body measurements come in step 8." /> },
  { pattern: '/food', render: () => <Placeholder title="Food" note="Macro goals and food logging come in steps 9–10." /> },
  { pattern: '/settings', render: () => <Settings /> },
];

export function App() {
  const path = useRoute();
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
