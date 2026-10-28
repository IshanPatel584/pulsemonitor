import { Link } from 'react-router-dom';
import { Compass } from 'lucide-react';
import Logo from '../components/layout/Logo';
import EmptyState from '../components/ui/EmptyState';
import { DASHBOARD_HOME } from '../config/navigation';
import { useAuth } from '../context/AuthContext';

/** Standalone 404 (outside the app shell), linking to wherever makes sense for the visitor. */
export default function NotFound() {
  const { status } = useAuth();
  const signedIn = status === 'authenticated';

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-bg px-4">
      <Link to="/" className="focus-ring mb-6 rounded-md" aria-label="PulseMonitor home">
        <Logo />
      </Link>
      <EmptyState
        icon={Compass}
        title="Page not found"
        description="The page you're looking for doesn't exist or has moved."
        action={
          <Link to={signedIn ? DASHBOARD_HOME : '/'} className="text-sm font-medium text-accent hover:underline">
            {signedIn ? 'Back to overview' : 'Back to the home page'}
          </Link>
        }
      />
    </div>
  );
}
