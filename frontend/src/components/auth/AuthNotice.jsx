import { CircleAlert, Info, Loader2, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { cn } from '../../lib/cn';

const NOTICES = {
  expired: 'Your session expired. Sign in again to continue.',
  elsewhere: 'You were signed out in another tab.',
  logout_failed:
    'You’re signed out in this tab, but the server couldn’t be reached to end your session. Sign in and sign out again once it’s back to fully end it.',
};

/** Banner above the login/signup form explaining why the user is here, or that the API is unreachable. */
export default function AuthNotice() {
  const { status, error, notice, dismissNotice, checkSession } = useAuth();

  if (status === 'error') {
    return (
      <div role="alert" className="mb-5 flex gap-2.5 rounded-lg border border-warning/30 bg-warning/10 px-3.5 py-3 text-sm text-fg">
        <CircleAlert className="mt-px h-3.5 w-3.5 shrink-0 text-warning" aria-hidden />
        <p className="flex-1">
          {error || 'Can’t reach the PulseMonitor API.'}{' '}
          <button type="button" onClick={checkSession} className="font-medium text-accent hover:underline">
            Try again
          </button>
        </p>
      </div>
    );
  }

  if (!notice || !NOTICES[notice]) return null;
  return (
    <div role="status" className={cn('mb-5 flex gap-2.5 rounded-lg border border-info/25 bg-info/10 px-3.5 py-3 text-sm text-fg')}>
      <Info className="mt-px h-3.5 w-3.5 shrink-0 text-info" aria-hidden />
      <p className="flex-1">{NOTICES[notice]}</p>
      <button type="button" onClick={dismissNotice} className="-m-0.5 rounded p-0.5 text-faint hover:text-fg" aria-label="Dismiss">
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

/** Shown instead of the form during the initial session check, so it doesn't flash before a redirect. */
export function CheckingSessionInline() {
  return (
    <p role="status" className="flex items-center justify-center gap-2 py-6 text-sm text-muted">
      <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
      Checking your session…
    </p>
  );
}
