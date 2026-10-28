import { Link } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';
import { DASHBOARD_HOME } from '../../config/navigation';
import { useAuth } from '../../context/AuthContext';
import Logo from '../layout/Logo';

/** Full-page "no access" message for signed-in users without the admin role. */
export function AccessDenied() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-bg px-4 text-center">
      <Logo />
      <div role="alert" className="w-full max-w-md animate-rise rounded-xl border border-line bg-surface px-6 py-10">
        <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-lg border border-danger/30 bg-danger/10 text-danger">
          <ShieldAlert className="h-5 w-5" aria-hidden />
        </div>
        <h1 className="text-sm font-medium text-fg">You don’t have access to the Admin Portal</h1>
        <p className="mx-auto mt-1 max-w-sm text-xs text-muted">
          This area is only for administrators. If you need access, ask an existing admin to change your role.
        </p>
        <Link
          to={DASHBOARD_HOME}
          className="focus-ring mt-5 inline-flex h-9 items-center rounded-md bg-accent px-3.5 text-sm font-medium text-accent-fg hover:bg-accent/90"
        >
          Go to your dashboard
        </Link>
      </div>
    </div>
  );
}

/**
 * Gate for /admin, inside RequireAuth (so the session is already checked and
 * the role comes from GET /api/me). This only decides what to render: every
 * admin API call is authorised again on the server.
 */
export default function RequireAdmin({ children }) {
  const { isAdmin } = useAuth();
  return isAdmin ? children : <AccessDenied />;
}
