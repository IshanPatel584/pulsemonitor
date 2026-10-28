import { CircleAlert, CircleCheck, Info, X } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { cn } from '../../lib/cn';

const ICONS = {
  success: { icon: CircleCheck, className: 'text-success' },
  error: { icon: CircleAlert, className: 'text-danger' },
  info: { icon: Info, className: 'text-info' },
};

export default function Toaster() {
  const { toasts, dismissToast } = useApp();

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-[calc(100%-2rem)] max-w-sm flex-col gap-2" aria-live="polite">
      {toasts.map((toast) => {
        const { icon: Icon, className } = ICONS[toast.tone] ?? ICONS.info;
        return (
          <div
            key={toast.id}
            className={cn(
              'pointer-events-auto flex items-start gap-3 rounded-lg border border-line bg-elevated px-3.5 py-3 text-sm shadow-popover',
              toast.leaving ? 'animate-toast-out' : 'animate-slide-in-right',
            )}
          >
            <Icon className={cn('mt-0.5 h-4 w-4 shrink-0', className)} aria-hidden />
            <p className="flex-1 text-fg">{toast.message}</p>
            <button
              type="button"
              onClick={() => dismissToast(toast.id)}
              className="focus-ring -m-1 flex h-6 w-6 shrink-0 items-center justify-center rounded text-faint transition-colors hover:bg-hover hover:text-fg"
              aria-label="Dismiss"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
