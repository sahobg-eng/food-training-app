import { render } from 'preact';
import { registerSW } from 'virtual:pwa-register';
import { initStorage } from './db/status';
import { App } from './ui/App';
import './ui/styles.css';

registerSW({ immediate: true });
void initStorage();

render(<App />, document.getElementById('app')!);
