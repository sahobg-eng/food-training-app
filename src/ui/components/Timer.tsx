import { useEffect, useState } from 'preact/hooks';
import { formatDuration } from '../../domain/format';

/** Elapsed time since `startedAt`, computed from the clock so it survives the app closing. */
export function Timer({ startedAt }: { startedAt: number }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  return <span class="timer">{formatDuration((now - startedAt) / 1000)}</span>;
}
