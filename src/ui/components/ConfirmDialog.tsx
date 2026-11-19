import { useEffect, useRef, useState } from 'preact/hooks';

export interface ConfirmOptions {
  title: string;
  message?: string;
  confirmLabel?: string;
  /** Red confirm button for deletes and other things that can't be undone. */
  danger?: boolean;
}

type Request = ConfirmOptions & { resolve: (ok: boolean) => void };

let show: ((r: Request) => void) | null = null;

/**
 * Ask the user to confirm, in an in-app dialog (instead of the browser's confirm box,
 * which on Android is headed with the site's address). Resolves true on confirm.
 */
export function confirmDialog(opts: ConfirmOptions): Promise<boolean> {
  return new Promise((resolve) => {
    if (show) show({ ...opts, resolve });
    else resolve(window.confirm([opts.title, opts.message].filter(Boolean).join('\n\n')));
  });
}

/** Render once at the app root. */
export function ConfirmHost() {
  const [req, setReq] = useState<Request | null>(null);
  const cancelBtn = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    show = (r) => setReq(r);
    return () => {
      show = null;
    };
  }, []);

  useEffect(() => {
    if (!req) return;
    // Focus Cancel, so a stray Enter never confirms a delete.
    cancelBtn.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [req]);

  function close(ok: boolean) {
    req?.resolve(ok);
    setReq(null);
  }

  if (!req) return null;
  return (
    <div class="dialog-backdrop" onClick={(e) => e.target === e.currentTarget && close(false)}>
      <div class="dialog" role="alertdialog" aria-modal="true" aria-labelledby="dlg-title" aria-describedby="dlg-msg">
        <h2 id="dlg-title">{req.title}</h2>
        {req.message && <p id="dlg-msg">{req.message}</p>}
        <div class="row">
          <button ref={cancelBtn} type="button" class="grow" onClick={() => close(false)}>
            Cancel
          </button>
          <button type="button" class={req.danger ? 'danger-solid grow' : 'primary grow'} onClick={() => close(true)}>
            {req.confirmLabel ?? 'OK'}
          </button>
        </div>
      </div>
    </div>
  );
}
