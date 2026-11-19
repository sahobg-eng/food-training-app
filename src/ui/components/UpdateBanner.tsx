import { useEffect, useState } from 'preact/hooks';
import { applyUpdate, isUpdateReady, onUpdateReady } from '../update';

export function UpdateBanner() {
  const [ready, setReady] = useState(isUpdateReady());
  useEffect(() => onUpdateReady(() => setReady(true)), []);
  if (!ready) return null;
  return (
    <div class="update-banner" role="status">
      <span class="grow">A new version is ready.</span>
      <button type="button" class="small-btn" onClick={() => setReady(false)}>
        Later
      </button>
      <button type="button" class="primary small-btn" onClick={applyUpdate}>
        Update
      </button>
    </div>
  );
}
