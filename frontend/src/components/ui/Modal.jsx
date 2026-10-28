import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Loader2, X } from 'lucide-react';
import { cn } from '../../lib/cn';

// Open overlays, newest last. Escape closes only the top one, so a confirm
// dialog opened from a drawer doesn't close the drawer too.
const overlayStack = [];

function useOverlay(open, onClose) {
  // Read through a ref so a new onClose each render doesn't re-register the
  // overlay (which would move it to the top of the stack).
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return undefined;
    const token = {};
    overlayStack.push(token);
    const onKey = (e) => e.key === 'Escape' && overlayStack.at(-1) === token && onCloseRef.current();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', onKey);
    return () => {
      overlayStack.splice(overlayStack.indexOf(token), 1);
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);
}

function OverlayHeader({ titleId, title, description, onClose }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
      <div className="min-w-0">
        <h2 id={titleId} className="text-sm font-semibold text-fg">
          {title}
        </h2>
        {description && <p className="mt-1 text-xs text-muted">{description}</p>}
      </div>
      <button
        type="button"
        onClick={onClose}
        className="focus-ring -mr-1 rounded-md p-1 text-muted transition-colors hover:bg-hover hover:text-fg"
        aria-label="Close"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

export function Modal({ open, onClose, title, description, children, footer, className }) {
  const titleId = useId();
  useOverlay(open, onClose);
  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 sm:items-center sm:p-6">
      <div className="fixed inset-0 bg-black/60 backdrop-blur-[1px] animate-fade-in" onClick={onClose} aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={cn('relative my-auto w-full max-w-lg rounded-xl border border-line bg-surface shadow-popover animate-scale-in', className)}
      >
        <OverlayHeader titleId={titleId} title={title} description={description} onClose={onClose} />
        {children}
        {footer && <div className="flex justify-end gap-2 border-t border-line px-5 py-3">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

export function Drawer({ open, onClose, title, description, children }) {
  const titleId = useId();
  useOverlay(open, onClose);
  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/60 animate-fade-in" onClick={onClose} aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="absolute inset-y-0 right-0 flex w-full max-w-md flex-col border-l border-line bg-surface shadow-popover animate-slide-in-right"
      >
        <OverlayHeader titleId={titleId} title={title} description={description} onClose={onClose} />
        <div className="flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>,
    document.body,
  );
}

/**
 * `onConfirm` may return a promise; the dialog shows `busyLabel` until it
 * settles and stays open (showing the error) if it rejects.
 */
export function ConfirmDialog({ open, onClose, onConfirm, title, description, confirmLabel = 'Confirm', busyLabel = 'Working…', tone = 'danger' }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setBusy(false);
      setError('');
    }
  }, [open]);

  const confirm = async () => {
    setBusy(true);
    setError('');
    try {
      await onConfirm();
      onClose();
    } catch (err) {
      setError(err?.message ?? 'Something went wrong.');
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={busy ? () => {} : onClose}
      title={title}
      className="max-w-md"
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="focus-ring h-9 rounded-md border border-line bg-surface px-3.5 text-sm font-medium text-fg hover:bg-hover disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            autoFocus
            onClick={confirm}
            disabled={busy}
            className={cn(
              'focus-ring inline-flex h-9 items-center gap-2 rounded-md px-3.5 text-sm font-medium text-white disabled:opacity-70',
              tone === 'danger' ? 'bg-danger hover:bg-danger/90' : 'bg-accent hover:bg-accent/90',
            )}
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
            {busy ? busyLabel : confirmLabel}
          </button>
        </>
      }
    >
      <div className="space-y-3 px-5 py-4">
        <p className="text-sm text-muted">{description}</p>
        {error && (
          <p role="alert" className="rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">
            {error}
          </p>
        )}
      </div>
    </Modal>
  );
}
