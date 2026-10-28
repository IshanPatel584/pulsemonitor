import { Link, Navigate, useLocation } from 'react-router-dom';
import AuthForm from '../components/auth/AuthForm';
import AuthLayout from '../components/auth/AuthLayout';
import AuthNotice, { CheckingSessionInline } from '../components/auth/AuthNotice';
import { safeReturnPath } from '../config/navigation';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { MIN_PASSWORD_LENGTH, validateSignup } from '../lib/authValidation';

// `confirmPassword` is checked in the browser only; it is never sent to the API.
const FIELDS = [
  { name: 'username', label: 'Username', autoComplete: 'username' },
  { name: 'email', label: 'Email', type: 'email', autoComplete: 'email' },
  { name: 'password', label: 'Password', type: 'password', autoComplete: 'new-password', hint: `At least ${MIN_PASSWORD_LENGTH} characters.` },
  { name: 'confirmPassword', label: 'Confirm password', type: 'password', autoComplete: 'new-password' },
];

export default function Signup() {
  const { status, signup } = useAuth();
  const { notify } = useApp();
  const location = useLocation();
  const returnTo = safeReturnPath(location.state?.from);

  if (status === 'authenticated') return <Navigate to={returnTo} replace />;

  return (
    <AuthLayout
      title="Create your account"
      description="Add your first endpoint in under a minute. Checks start right away."
      footer={
        <>
          Already have an account?{' '}
          <Link to="/login" state={location.state} className="focus-ring rounded font-medium text-accent hover:underline">
            Log in
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
            validate={validateSignup}
            submitLabel="Create account"
            busyLabel="Creating account…"
            onSubmit={async ({ username, email, password }) => {
              // Only the fields the backend accepts; no role or other extras are sent.
              await signup({ username: username.trim(), email: email.trim(), password });
              notify('Account created. Add your first monitor to start checking.');
            }}
          />
        </>
      )}
    </AuthLayout>
  );
}
