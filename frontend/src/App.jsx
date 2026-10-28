import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import RequireAdmin from './components/admin/RequireAdmin';
import RequireAuth from './components/auth/RequireAuth';
import AppLayout from './components/layout/AppLayout';
import Analytics from './pages/Analytics';
import Incidents from './pages/Incidents';
import Landing from './pages/Landing';
import Login from './pages/Login';
import Monitors from './pages/Monitors';
import NotFound from './pages/NotFound';
import Overview from './pages/Overview';
import Settings from './pages/Settings';
import Signup from './pages/Signup';

// Admin Portal pages load on demand; regular users never download them.
const AdminLayout = lazy(() => import('./components/admin/AdminLayout'));
const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard'));
const AdminUsers = lazy(() => import('./pages/admin/AdminUsers'));
const AdminMonitors = lazy(() => import('./pages/admin/AdminMonitors'));
const AdminIncidents = lazy(() => import('./pages/admin/AdminIncidents'));
const AdminHealth = lazy(() => import('./pages/admin/AdminHealth'));
const AdminSettings = lazy(() => import('./pages/admin/AdminSettings'));

export default function App() {
  return (
    <Routes>
      {/* Public */}
      <Route index element={<Landing />} />
      <Route path="login" element={<Login />} />
      <Route path="signup" element={<Signup />} />

      {/* Signed-in users only; RequireAuth redirects to /login with a return path. */}
      <Route
        element={
          <RequireAuth>
            <AppLayout />
          </RequireAuth>
        }
      >
        <Route path="overview" element={<Overview />} />
        <Route path="monitors" element={<Monitors />} />
        <Route path="incidents" element={<Incidents />} />
        <Route path="analytics" element={<Analytics />} />
        <Route path="settings" element={<Settings />} />
      </Route>

      {/* Admins only. RequireAdmin shows "access denied" to everyone else, and
          every /api/admin request is authorised again on the server. */}
      <Route
        path="admin"
        element={
          <RequireAuth>
            <RequireAdmin>
              <Suspense fallback={<div className="min-h-dvh bg-bg" aria-busy="true" />}>
                <AdminLayout />
              </Suspense>
            </RequireAdmin>
          </RequireAuth>
        }
      >
        <Route index element={<AdminDashboard />} />
        <Route path="users" element={<AdminUsers />} />
        <Route path="monitors" element={<AdminMonitors />} />
        <Route path="incidents" element={<AdminIncidents />} />
        <Route path="health" element={<AdminHealth />} />
        <Route path="settings" element={<AdminSettings />} />
        <Route path="*" element={<Navigate to="/admin" replace />} />
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
