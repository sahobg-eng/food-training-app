import type { ComponentChildren } from 'preact';
import { useRoute } from '../router';
import { BottomNav, type Tab } from './components/BottomNav';
import { Placeholder } from './screens/Placeholder';

const TABS: Tab[] = [
  { path: '/train', label: 'Train' },
  { path: '/body', label: 'Body' },
  { path: '/food', label: 'Food' },
  { path: '/settings', label: 'Settings' },
];

export function App() {
  const path = useRoute();
  const tab = TABS.find((t) => path === t.path || path.startsWith(t.path + '/')) ?? TABS[0];

  let screen: ComponentChildren;
  switch (tab.path) {
    case '/train':
      screen = <Placeholder title="Train" note="Workouts, routines and exercises come in steps 3–6." />;
      break;
    case '/body':
      screen = <Placeholder title="Body" note="Body measurements come in step 8." />;
      break;
    case '/food':
      screen = <Placeholder title="Food" note="Macro goals and food logging come in steps 9–10." />;
      break;
    default:
      screen = <Placeholder title="Settings" note="Export and import come in step 7." />;
  }

  return (
    <div class="app">
      <main class="screen">{screen}</main>
      <BottomNav tabs={TABS} active={tab.path} />
    </div>
  );
}
