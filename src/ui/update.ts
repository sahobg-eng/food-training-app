import { registerSW } from 'virtual:pwa-register';

type Listener = () => void;
const listeners = new Set<Listener>();
let needRefresh = false;
let updateSW: ((reload?: boolean) => Promise<void>) | null = null;

const HOUR = 3_600_000;

/**
 * Register the service worker. A new version waits until the user taps "Update", so an
 * update never reloads the page while something is being typed. The app also checks for
 * a new version every hour while it stays open.
 */
export function startServiceWorker(): void {
  updateSW = registerSW({
    immediate: true,
    onNeedRefresh() {
      needRefresh = true;
      listeners.forEach((l) => l());
    },
    onRegisteredSW(_url, registration) {
      if (registration) setInterval(() => void registration.update().catch(() => undefined), HOUR);
    },
  });
}

export const isUpdateReady = () => needRefresh;

export function onUpdateReady(l: Listener): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function applyUpdate(): void {
  void updateSW?.(true);
  // updateSW reloads once the new version takes control. A page that was never controlled
  // (the very first visit after installing) gets no such event, so reload anyway.
  setTimeout(() => location.reload(), 1500);
}
