import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import ErrorState from '../ui/ErrorState';
import Logo from '../layout/Logo';

const SLOW_AFTER_MS = 4000;

function FullScreen({ children }) {
  return <div className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-bg px-4 text-center">{children}</div>;
}

/** Spinner for the one-time session check, with a hint if the API is slow to answer. */
function CheckingSession() {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    const id = setTimeout(() => setSlow(true), SLOW_AFTER_MS);
    return () => clearTimeout(id);
  }, []);

  return (
    <FullScreen>
      <Logo />
      <div role="status" aria-live="polite">
        <p className="flex items-center justify-center gap-2 text-sm text-muted">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          Checking your session…
        </p>
        {slow && <p className="mt-2 text-xs text-faint">Still waiting for the API. This can take a moment if the server just started.</p>}
      </div>
    </FullScreen>
  );
}

/**
 * Gate for the app shell: waits for the session check, then shows the app or
 * redirects to /login (remembering where the user was headed).
 * A network/server error is shown as such — it is not treated as signed out.
 */
export default function RequireAuth({ children }) {
  const { status, error, checkSession } = useAuth();
  const location = useLocation();

  if (status === 'checking') return <CheckingSession />;

  if (status === 'error') {
    return (
      <FullScreen>
        <Logo />
        <div className="w-full max-w-md rounded-xl border border-line bg-surface">
          <ErrorState title="Couldn’t reach PulseMonitor" message={error} onRetry={checkSession} />
        </div>
        <Link to="/" className="text-xs text-muted hover:text-fg hover:underline">
          Back to the home page
        </Link>
      </FullScreen>
    );
  }

  if (status === 'anonymous') {
    return <Navigate to="/login" replace state={{ from: `${location.pathname}${location.search}` }} />;
  }

  return children;
}
