import { Activity, BarChart3, LayoutDashboard, Server, Settings, ShieldCheck, TriangleAlert, Users } from 'lucide-react';

/** Where signed-in users land by default. `/` is the public landing page. */
export const DASHBOARD_HOME = '/overview';

export const NAV_ITEMS = [
  { to: DASHBOARD_HOME, label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/monitors', label: 'Monitors', icon: Server },
  { to: '/incidents', label: 'Incidents', icon: TriangleAlert, badge: 'activeIncidents' },
  { to: '/analytics', label: 'Analytics', icon: BarChart3 },
  { to: '/settings', label: 'Settings', icon: Settings },
];

/** Admin Portal. Shown only to admins; every page's data is also admin-only on the server. */
export const ADMIN_HOME = '/admin';
export const ADMIN_ICON = ShieldCheck;

export const ADMIN_NAV_ITEMS = [
  { to: ADMIN_HOME, label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/admin/users', label: 'Users', icon: Users },
  { to: '/admin/monitors', label: 'Monitors', icon: Server },
  { to: '/admin/incidents', label: 'Incidents', icon: TriangleAlert },
  { to: '/admin/health', label: 'System Health', icon: Activity },
  { to: '/admin/settings', label: 'Settings', icon: Settings },
];

const matches = (pathname) => (item) => (item.end ? pathname === item.to : pathname.startsWith(item.to));

export function pageTitle(pathname) {
  if (pathname === ADMIN_HOME || pathname.startsWith(`${ADMIN_HOME}/`)) {
    return ADMIN_NAV_ITEMS.find(matches(pathname))?.label ?? 'Not found';
  }
  return NAV_ITEMS.find(matches(pathname))?.label ?? 'Not found';
}

// Paths a "return to" redirect may never point at: the auth pages themselves
// (would loop) and the landing page (not where a signed-in user asked to go).
const NO_RETURN = /^\/(login|signup)?(?:[/?#]|$)/;

/**
 * Returns `from` if it is a same-app path that is safe to navigate to after
 * signing in, otherwise the dashboard. Rejects absolute and protocol-relative
 * URLs (`https://…`, `//evil.example`, `/\\evil.example`) and auth pages.
 */
export function safeReturnPath(from) {
  if (typeof from !== 'string' || from.length > 2048) return DASHBOARD_HOME;
  if (!from.startsWith('/') || from.startsWith('//') || from.includes('\\')) return DASHBOARD_HOME;
  if (NO_RETURN.test(from)) return DASHBOARD_HOME;
  return from;
}
