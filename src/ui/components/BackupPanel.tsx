import { useEffect, useRef, useState } from 'preact/hooks';
import {
  backupFileName,
  buildBackup,
  countRows,
  getLastExportAt,
  parseBackup,
  recordExport,
  restoreBackup,
  serializeBackup,
  STORE_LABELS,
  type Backup,
} from '../../db/backup';
import type { StoreName } from '../../db/schema';
import { toTimeStr, toDateStr } from '../../domain/dates';
import { formatDay } from '../../domain/format';
import { errorMessage } from '../errors';

const DAY = 86_400_000;

export function describeLastExport(at: number | null, now = Date.now()): string {
  if (at === null) return 'Never';
  const days = Math.floor((now - at) / DAY);
  const when = `${formatDay(toDateStr(at))}, ${toTimeStr(at)}`;
  return days < 1 ? `Today, ${toTimeStr(at)}` : `${when} (${days} ${days === 1 ? 'day' : 'days'} ago)`;
}

function summary(counts: Record<StoreName, number>): string {
  const parts = (Object.keys(STORE_LABELS) as StoreName[])
    .filter((s) => counts[s] > 0)
    .map((s) => `${counts[s]} ${STORE_LABELS[s]![counts[s] === 1 ? 0 : 1]}`);
  return parts.length ? parts.join(', ') : 'no records';
}

function canShareFiles(): boolean {
  try {
    const probe = new File(['{}'], 'probe.json', { type: 'application/json' });
    return typeof navigator.canShare === 'function' && navigator.canShare({ files: [probe] });
  } catch {
    return false;
  }
}

export function BackupPanel() {
  const [lastExport, setLastExport] = useState<number | null | undefined>(undefined);
  const [pending, setPending] = useState<{ backup: Backup; fileName: string } | null>(null);
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const shareable = canShareFiles();

  useEffect(() => void getLastExportAt().then(setLastExport), []);

  async function makeFile(): Promise<{ file: File; exportedAt: number }> {
    const backup = await buildBackup();
    const file = new File([serializeBackup(backup)], backupFileName(backup.exportedAt), { type: 'application/json' });
    return { file, exportedAt: backup.exportedAt };
  }

  async function done(exportedAt: number, how: string) {
    await recordExport(exportedAt);
    setLastExport(exportedAt);
    setMessage({ text: how });
  }

  async function onDownload() {
    setBusy(true);
    try {
      const { file, exportedAt } = await makeFile();
      const url = URL.createObjectURL(file);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
      await done(exportedAt, `Saved ${file.name} to Downloads.`);
    } catch (e) {
      setMessage({ text: errorMessage(e), error: true });
    }
    setBusy(false);
  }

  async function onShare() {
    setBusy(true);
    try {
      const { file, exportedAt } = await makeFile();
      await navigator.share({ files: [file], title: 'Food & Training backup' });
      await done(exportedAt, `Shared ${file.name}.`);
    } catch (e) {
      // Closing the share sheet is not an error and is not a backup.
      if ((e as DOMException)?.name !== 'AbortError') setMessage({ text: 'Sharing failed. Try "Save file" instead.', error: true });
    }
    setBusy(false);
  }

  async function onFileChosen(ev: Event) {
    const input = ev.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = ''; // let the same file be picked again
    if (!file) return;
    setMessage(null);
    try {
      setPending({ backup: parseBackup(await file.text()), fileName: file.name });
    } catch (e) {
      setMessage({ text: errorMessage(e), error: true });
    }
  }

  async function onRestore() {
    if (!pending) return;
    setBusy(true);
    try {
      await restoreBackup(pending.backup);
      // Every screen reads from the database; a reload is the simplest way to refresh them all.
      location.hash = '#/train';
      location.reload();
    } catch (e) {
      setMessage({ text: errorMessage(e), error: true });
      setBusy(false);
    }
  }

  const stale = lastExport === null || (lastExport !== undefined && Date.now() - lastExport > 7 * DAY);

  return (
    <div class="backup">
      <p class="muted small">
        Your data lives only on this phone. Export a backup regularly and keep the file somewhere else (e.g. Google
        Drive).
      </p>
      <dl class="kv">
        <dt>Last backup</dt>
        <dd class={stale ? 'warn' : ''}>{lastExport === undefined ? '…' : describeLastExport(lastExport)}</dd>
      </dl>

      <div class="row wrap">
        {shareable && (
          <button type="button" class="primary grow" disabled={busy} onClick={onShare}>
            Share backup…
          </button>
        )}
        <button type="button" class={shareable ? 'grow' : 'primary grow'} disabled={busy} onClick={onDownload}>
          Save file
        </button>
      </div>

      <h2>Restore</h2>
      {pending ? (
        <div class="confirm-box">
          <p>
            <strong>{pending.fileName}</strong>
            <br />
            <span class="muted small">
              Exported {describeLastExport(pending.backup.exportedAt)} · {summary(countRows(pending.backup))}
            </span>
          </p>
          <p class="warn small">
            This replaces <strong>all</strong> data on this phone with the backup. Anything added since it was made
            will be lost.
          </p>
          <div class="row">
            <button type="button" class="danger grow" disabled={busy} onClick={onRestore}>
              Replace my data
            </button>
            <button type="button" disabled={busy} onClick={() => setPending(null)}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button type="button" class="block" disabled={busy} onClick={() => fileInput.current?.click()}>
          Restore from backup file…
        </button>
      )}
      <input ref={fileInput} type="file" accept=".json,application/json" hidden onChange={onFileChosen} />

      {message && <p class={message.error ? 'error' : 'ok'}>{message.text}</p>}
    </div>
  );
}
