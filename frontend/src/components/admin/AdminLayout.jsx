import { Suspense, useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { ArrowLeft, Menu, PanelLeftClose, PanelLeftOpen, X } from 'lucide-react';
import { ADMIN_HOME, ADMIN_ICON as AdminIcon, ADMIN_NAV_ITEMS, DASHBOARD_HOME, pageTitle } from '../../config/navigation';
import { usePreferences } from '../../context/PreferencesContext';
import { cn } from '../../lib/cn';
import Logo from '../layout/Logo';
import UserMenu from '../layout/UserMenu';
import Toaster from '../ui/Toaster';

function AdminNav({ collapsed }) {
  return (
    <nav className="flex flex-col gap-0.5 px-2" aria-label="Admin">
      {ADMIN_NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
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
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
}

function AdminSidebarContent({ collapsed, onToggleCollapse, onClose }) {
  return (
    <div className="flex h-full flex-col">
      <div className={cn('flex h-14 shrink-0 items-center px-4', collapsed && 'justify-center px-0')}>
        <NavLink to={ADMIN_HOME} className="focus-ring rounded-md" aria-label="Admin Portal dashboard">
          <Logo showName={!collapsed} />
        </NavLink>
        {onClose && (
          <button type="button" onClick={onClose} className="ml-auto rounded-md p-1 text-muted hover:bg-hover hover:text-fg" aria-label="Close navigation">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="mt-2 flex-1 overflow-y-auto">
        {!collapsed && (
          <p className="mb-1.5 flex items-center gap-1.5 px-4 text-2xs font-medium uppercase tracking-wider text-faint">
            <AdminIcon className="h-3 w-3" aria-hidden /> Admin Portal
          </p>
        )}
        <AdminNav collapsed={collapsed} />
      </div>

      <div className="shrink-0 space-y-1 px-2 pb-3">
        <NavLink
          to={DASHBOARD_HOME}
          title={collapsed ? 'Back to workspace' : undefined}
          className={cn(
            'focus-ring flex h-8 items-center gap-2.5 rounded-md px-2 text-sm text-muted transition-colors hover:bg-hover hover:text-fg',
            collapsed && 'justify-center',
          )}
        >
          <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden />
          {!collapsed && <span>Back to workspace</span>}
        </NavLink>
        {onToggleCollapse && (
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
        )}
      </div>
    </div>
  );
}

/** Shell for /admin/*: the workspace layout's structure with the admin navigation. */
export default function AdminLayout() {
  const { sidebarCollapsed, setSidebarCollapsed } = usePreferences();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const { pathname } = useLocation();

  useEffect(() => setMobileNavOpen(false), [pathname]);

  return (
    <div className="flex h-dvh overflow-hidden bg-bg">
      <aside
        className={cn(
          'hidden shrink-0 border-r border-line bg-surface transition-[width] duration-200 ease-out lg:block',
          sidebarCollapsed ? 'w-[60px]' : 'w-[232px]',
        )}
      >
        <AdminSidebarContent collapsed={sidebarCollapsed} onToggleCollapse={() => setSidebarCollapsed((c) => !c)} />
      </aside>

      {mobileNavOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/60 animate-fade-in" onClick={() => setMobileNavOpen(false)} aria-hidden />
          <aside className="absolute inset-y-0 left-0 w-[260px] border-r border-line bg-surface animate-slide-in-left">
            <AdminSidebarContent collapsed={false} onClose={() => setMobileNavOpen(false)} />
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col overflow-y-auto">
        <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-3 border-b border-line bg-bg/85 px-4 backdrop-blur sm:px-6 lg:px-8">
          <button
            type="button"
            onClick={() => setMobileNavOpen(true)}
            className="focus-ring -ml-1 rounded-md p-1.5 text-muted hover:bg-hover hover:text-fg lg:hidden"
            aria-label="Open navigation"
          >
            <Menu className="h-5 w-5" />
          </button>
          <h1 className="truncate text-[15px] font-medium text-fg">{pageTitle(pathname)}</h1>
          <span className="hidden items-center gap-1 rounded border border-accent/25 bg-accent/10 px-1.5 py-0.5 text-2xs font-medium uppercase tracking-wide text-accent sm:inline-flex">
            <AdminIcon className="h-3 w-3" aria-hidden /> Admin
          </span>
          <div className="ml-auto flex items-center gap-2">
            <UserMenu />
          </div>
        </header>
        <main key={pathname} className="mx-auto w-full max-w-[1440px] flex-1 animate-page-in px-4 py-6 sm:px-6 lg:px-8">
          {/* Pages are code-split; keep the shell on screen while one loads. */}
          <Suspense fallback={<div className="h-64 skeleton rounded-lg border border-line bg-hover/40" aria-busy="true" />}>
            <Outlet />
          </Suspense>
        </main>
      </div>
      <Toaster />
    </div>
  );
}
