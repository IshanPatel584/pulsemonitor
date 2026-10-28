import { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { usePreferences } from '../../context/PreferencesContext';
import AddMonitorModal from '../monitors/AddMonitorModal';
import Toaster from '../ui/Toaster';
import Sidebar from './Sidebar';
import Topbar from './Topbar';

export default function AppLayout() {
  const { sidebarCollapsed, setSidebarCollapsed } = usePreferences();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const { pathname } = useLocation();

  useEffect(() => setMobileNavOpen(false), [pathname]);

  return (
    <div className="flex h-dvh overflow-hidden bg-bg">
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed((c) => !c)}
        mobileOpen={mobileNavOpen}
        onCloseMobile={() => setMobileNavOpen(false)}
      />
      <div className="flex min-w-0 flex-1 flex-col overflow-y-auto">
        <Topbar onOpenNav={() => setMobileNavOpen(true)} />
        <main key={pathname} className="mx-auto w-full max-w-[1440px] flex-1 animate-page-in px-4 py-6 sm:px-6 lg:px-8">
          <Outlet />
        </main>
      </div>
      <AddMonitorModal />
      <Toaster />
    </div>
  );
}
