import { Link, Navigate, useLocation } from 'react-router-dom';
import AuthForm from '../components/auth/AuthForm';
import AuthLayout from '../components/auth/AuthLayout';
import AuthNotice, { CheckingSessionInline } from '../components/auth/AuthNotice';
import { safeReturnPath } from '../config/navigation';
import { useAuth } from '../context/AuthContext';
import { validateLogin } from '../lib/authValidation';

const FIELDS = [
  { name: 'email', label: 'Email', type: 'email', autoComplete: 'email' },
  { name: 'password', label: 'Password', type: 'password', autoComplete: 'current-password' },
];

export default function Login() {
  const { status, login } = useAuth();
  const location = useLocation();
  const returnTo = safeReturnPath(location.state?.from);

  // Already signed in (or just signed in): go where the user was headed.
  if (status === 'authenticated') return <Navigate to={returnTo} replace />;

  return (
    <AuthLayout
      title="Welcome back"
      description="Log in to see your monitors, incidents, and response times."
      footer={
        <>
          New to PulseMonitor?{' '}
          <Link to="/signup" state={location.state} className="focus-ring rounded font-medium text-accent hover:underline">
            Create an account
          </Link>
        </>
      }
    >
      {status === 'checking' ? (
        <CheckingSessionInline />
      ) : (
        <>
          <AuthNotice />
          <AuthForm
            fields={FIELDS}
            validate={validateLogin}
            submitLabel="Log in"
            busyLabel="Logging in…"
            onSubmit={({ email, password }) => login({ email: email.trim(), password })}
          />
        </>
      )}
    </AuthLayout>
  );
}
