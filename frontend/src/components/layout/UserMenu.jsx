import { useLocation, useNavigate } from 'react-router-dom';
import { ChevronDown, LayoutDashboard, LogOut, Moon, Settings, Sun, User } from 'lucide-react';
import { ADMIN_HOME, ADMIN_ICON, DASHBOARD_HOME } from '../../config/navigation';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { usePreferences } from '../../context/PreferencesContext';
import { initials } from '../../lib/format';
import { cn } from '../../lib/cn';
import { Dropdown, DropdownItem, DropdownSeparator } from '../ui/Dropdown';

export function Avatar({ name, size = 'sm' }) {
  return (
    <span
      className={cn(
        'flex shrink-0 items-center justify-center rounded-full bg-accent/15 font-medium text-accent',
        size === 'sm' ? 'h-7 w-7 text-2xs' : 'h-12 w-12 text-base',
      )}
      aria-hidden
    >
      {initials(name)}
    </span>
  );
}

export default function UserMenu() {
  const { profile } = useApp();
  const { logout, isAdmin } = useAuth();
  const { pathname } = useLocation();
  const inAdmin = pathname === ADMIN_HOME || pathname.startsWith(`${ADMIN_HOME}/`);
  const { resolvedTheme, toggleTheme } = usePreferences();
  const navigate = useNavigate();
  const dark = resolvedTheme === 'dark';

  return (
    <Dropdown
      width={232}
      trigger={({ open, ...props }) => (
        <button
          {...props}
          type="button"
          aria-label="Account menu"
          className={cn('focus-ring flex items-center gap-1.5 rounded-full p-0.5 pr-1.5 transition-colors hover:bg-hover', open && 'bg-hover')}
        >
          <Avatar name={profile.name} />
          <ChevronDown className="hidden h-3.5 w-3.5 text-muted sm:block" />
        </button>
      )}
    >
      <div className="px-2 py-1.5">
        <p className="truncate text-sm font-medium text-fg">{profile.name}</p>
        <p className="truncate text-xs text-muted">{profile.email}</p>
      </div>
      <DropdownSeparator />
      {isAdmin &&
        (inAdmin ? (
          <DropdownItem icon={LayoutDashboard} onSelect={() => navigate(DASHBOARD_HOME)}>
            Back to workspace
          </DropdownItem>
        ) : (
          <DropdownItem icon={ADMIN_ICON} onSelect={() => navigate(ADMIN_HOME)}>
            Admin Portal
          </DropdownItem>
        ))}
      <DropdownItem icon={User} onSelect={() => navigate('/settings?tab=profile')}>
        Profile
      </DropdownItem>
      <DropdownItem icon={Settings} onSelect={() => navigate('/settings')}>
        Settings
      </DropdownItem>
      <DropdownItem icon={dark ? Sun : Moon} onSelect={toggleTheme}>
        {dark ? 'Light mode' : 'Dark mode'}
      </DropdownItem>
      <DropdownSeparator />
      <DropdownItem
        icon={LogOut}
        onSelect={async () => {
          // Signs out locally and redirects to the landing page (see AuthContext.logout).
          await logout();
        }}
      >
        Sign out
      </DropdownItem>
    </Dropdown>
  );
}
