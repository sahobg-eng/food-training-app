import { useEffect, useState } from 'preact/hooks';
import { getStorageStatus, type StorageStatus } from '../../db/status';
import { BackupPanel } from '../components/BackupPanel';

const PERSIST_LABEL = {
  persistent: 'Persistent — the browser will not clear it on its own',
  'best-effort': 'Best effort — the browser may clear it if storage runs low',
  unsupported: 'Unknown — this browser cannot report it',
} as const;

export function Settings() {
  const [status, setStatus] = useState<StorageStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getStorageStatus().then(setStatus, (e: unknown) => setError(String(e)));
  }, []);

  return (
    <section>
      <h1>Settings</h1>
      <h2>Backup</h2>
      <BackupPanel />
      <h2>Storage</h2>
      {error && <p class="error">Database error: {error}</p>}
      {!status && !error && <p class="muted">Checking…</p>}
      {status && (
        <dl class="kv">
          <dt>Database</dt>
          <dd>Ready, schema v{status.schemaVersion}</dd>
          <dt>Data on this phone</dt>
          <dd>{PERSIST_LABEL[status.persist]}</dd>
          <dt>Measurement types</dt>
          <dd>{status.measurementTypes}</dd>
          {status.usageBytes !== null && (
            <>
              <dt>Space used</dt>
              <dd>{(status.usageBytes / 1024).toFixed(0)} KB</dd>
            </>
          )}
        </dl>
      )}
    </section>
  );
}
