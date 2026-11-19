import { render } from 'preact';
import { initStorage } from './db/status';
import { App } from './ui/App';
import { ErrorBoundary } from './ui/components/ErrorBoundary';
import { startServiceWorker } from './ui/update';
import './ui/styles.css';

startServiceWorker();
void initStorage();

render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>,
  document.getElementById('app')!,
);
