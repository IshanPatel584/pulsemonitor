import { useLocation } from 'react-router-dom';
import { Menu } from 'lucide-react';
import { pageTitle } from '../../config/navigation';
import NotificationsMenu from './NotificationsMenu';
import SearchMenu from './SearchMenu';
import UserMenu from './UserMenu';

export default function Topbar({ onOpenNav }) {
  const { pathname } = useLocation();

  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-3 border-b border-line bg-bg/85 px-4 backdrop-blur sm:px-6 lg:px-8">
      <button
        type="button"
        onClick={onOpenNav}
        className="focus-ring -ml-1 rounded-md p-1.5 text-muted hover:bg-hover hover:text-fg lg:hidden"
        aria-label="Open navigation"
      >
        <Menu className="h-5 w-5" />
      </button>

      <h1 className="truncate text-[15px] font-medium text-fg">{pageTitle(pathname)}</h1>

      <div className="ml-auto flex items-center gap-2">
        <SearchMenu />
        <NotificationsMenu />
        <div className="mx-1 hidden h-5 w-px bg-line sm:block" />
        <UserMenu />
      </div>
    </header>
  );
}
