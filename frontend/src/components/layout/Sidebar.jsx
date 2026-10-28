import { NavLink } from 'react-router-dom';
import { PanelLeftClose, PanelLeftOpen, X } from 'lucide-react';
import { ADMIN_HOME, ADMIN_ICON as AdminIcon, DASHBOARD_HOME, NAV_ITEMS } from '../../config/navigation';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { countByStatus } from '../../lib/monitors';
import { cn } from '../../lib/cn';
import Logo from './Logo';

function NavItems({ collapsed, activeIncidents }) {
  return (
    <nav className="flex flex-col gap-0.5 px-2" aria-label="Main">
      {NAV_ITEMS.map(({ to, label, icon: Icon, end, badge }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          title={collapsed ? label : undefined}
          className={({ isActive }) =>
            cn(
              'focus-ring group flex h-8 items-center gap-2.5 rounded-md px-2 text-sm transition-colors duration-200 ease-out-soft',
              collapsed && 'justify-center',
              isActive ? 'bg-hover font-medium text-fg' : 'text-muted hover:bg-hover/60 hover:text-fg',
            )
          }
        >
          {({ isActive }) => (
            <>
              <Icon
                className={cn(
                  'h-4 w-4 shrink-0 transition-[color,transform] duration-200 ease-out-soft group-active:scale-90',
                  isActive ? 'text-fg' : 'text-faint group-hover:text-muted',
                )}
                aria-hidden
              />
              {!collapsed && <span className="flex-1 truncate">{label}</span>}
              {!collapsed && badge === 'activeIncidents' && activeIncidents > 0 && (
                <span className="rounded bg-danger/15 px-1.5 text-2xs font-medium tabular-nums text-danger">{activeIncidents}</span>
              )}
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
}

function HealthSummary({ collapsed }) {
  const { monitors, monitorsStatus } = useApp();
  const counts = countByStatus(monitors);
  const healthy = counts.down === 0;

  if (monitorsStatus !== 'ready') {
    return collapsed ? null : <div className="mx-2 h-[54px] skeleton rounded-md border border-line bg-hover/40" aria-hidden />;
  }

  if (collapsed) {
    return (
      <div className="flex justify-center py-2" title={`${counts.up} of ${monitors.length} monitors up`}>
        <span className={cn('h-2 w-2 rounded-full', healthy ? 'bg-success' : 'bg-danger')} />
      </div>
    );
  }

  return (
    <div className="mx-2 rounded-md border border-line px-3 py-2.5">
      <div className="flex items-center gap-2 text-xs font-medium text-fg">
        <span className={cn('h-1.5 w-1.5 rounded-full', healthy ? 'bg-success' : 'bg-danger')} />
        {monitors.length === 0
          ? 'No monitors yet'
          : healthy
            ? 'No monitors down'
            : `${counts.down} monitor${counts.down === 1 ? '' : 's'} down`}
      </div>
      <p className="mt-1 text-2xs text-muted tabular-nums">
        {counts.up} up · {counts.unknown} unknown
      </p>
    </div>
  );
}

/** Link to the Admin Portal, rendered only for admins (the server enforces access regardless). */
function AdminLink({ collapsed }) {
  return (
    <div className="mt-4">
      {!collapsed && <p className="mb-1.5 px-4 text-2xs font-medium uppercase tracking-wider text-faint">Administration</p>}
      <nav className="px-2" aria-label="Administration">
        <NavLink
          to={ADMIN_HOME}
          title={collapsed ? 'Admin Portal' : undefined}
          className={cn(
            'focus-ring group flex h-8 items-center gap-2.5 rounded-md px-2 text-sm text-muted transition-colors duration-200 ease-out-soft hover:bg-hover/60 hover:text-fg',
            collapsed && 'justify-center',
          )}
        >
          <AdminIcon className="h-4 w-4 shrink-0 text-faint transition-colors group-hover:text-muted" aria-hidden />
          {!collapsed && <span className="flex-1 truncate">Admin Portal</span>}
        </NavLink>
      </nav>
    </div>
  );
}

function SidebarContent({ collapsed, onToggleCollapse, onClose }) {
  const { incidents } = useApp();
  const { isAdmin } = useAuth();
  const activeIncidents = incidents.filter((i) => i.status === 'open').length;

  return (
    <div className="flex h-full flex-col">
      <div className={cn('flex h-14 shrink-0 items-center px-4', collapsed && 'justify-center px-0')}>
        <NavLink to={DASHBOARD_HOME} className="focus-ring rounded-md" aria-label="PulseMonitor overview">
          <Logo showName={!collapsed} />
        </NavLink>
        {onClose && (
          <button type="button" onClick={onClose} className="ml-auto rounded-md p-1 text-muted hover:bg-hover hover:text-fg" aria-label="Close navigation">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="mt-2 flex-1 overflow-y-auto">
        {!collapsed && <p className="mb-1.5 px-4 text-2xs font-medium uppercase tracking-wider text-faint">Workspace</p>}
        <NavItems collapsed={collapsed} activeIncidents={activeIncidents} />
        {isAdmin && <AdminLink collapsed={collapsed} />}
      </div>

      <div className="shrink-0 space-y-2 pb-3">
        <HealthSummary collapsed={collapsed} />
        {onToggleCollapse && (
          <div className="px-2">
            <button
              type="button"
              onClick={onToggleCollapse}
              className={cn(
                'focus-ring flex h-8 w-full items-center gap-2.5 rounded-md px-2 text-sm text-muted transition-colors hover:bg-hover hover:text-fg',
                collapsed && 'justify-center',
              )}
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              title={collapsed ? 'Expand sidebar' : undefined}
            >
              {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
              {!collapsed && <span>Collapse</span>}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function Sidebar({ collapsed, onToggleCollapse, mobileOpen, onCloseMobile }) {
  return (
    <>
      <aside
        className={cn(
          'hidden shrink-0 border-r border-line bg-surface transition-[width] duration-200 ease-out lg:block',
          collapsed ? 'w-[60px]' : 'w-[232px]',
        )}
      >
        <SidebarContent collapsed={collapsed} onToggleCollapse={onToggleCollapse} />
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/60 animate-fade-in" onClick={onCloseMobile} aria-hidden />
          <aside className="absolute inset-y-0 left-0 w-[260px] border-r border-line bg-surface animate-slide-in-left">
            <SidebarContent collapsed={false} onClose={onCloseMobile} />
          </aside>
        </div>
      )}
    </>
  );
}
