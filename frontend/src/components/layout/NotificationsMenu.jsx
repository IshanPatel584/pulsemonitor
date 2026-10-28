import { useNavigate } from 'react-router-dom';
import { Bell, CircleCheck, TriangleAlert } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useLocalStorage } from '../../hooks/useLocalStorage';
import { useNow } from '../../hooks/useNow';
import { formatDuration, formatRelative } from '../../lib/format';
import { incidentMonitorName } from '../incidents/IncidentList';
import { cn } from '../../lib/cn';
import { Dropdown, useDropdownClose } from '../ui/Dropdown';

/** One entry per incident, dated by its latest change (resolved time, else start time). */
function buildNotifications(incidents) {
  return incidents
    .map((inc) => {
      const resolved = inc.status === 'resolved';
      const name = incidentMonitorName(inc);
      return {
        id: inc.id,
        resolved,
        title: resolved ? `${name} recovered` : `${name} is down`,
        detail: resolved && inc.resolvedAt ? `Resolved after ${formatDuration(inc.resolvedAt - inc.startedAt)} · ${inc.reason}` : inc.reason,
        at: inc.resolvedAt ?? inc.startedAt,
      };
    })
    .sort((a, b) => b.at - a.at)
    .slice(0, 6);
}

function NotificationList({ items, readAt, onMarkAllRead, status, error }) {
  const navigate = useNavigate();
  const close = useDropdownClose();
  const now = useNow(30_000);
  const unread = items.filter((n) => n.at > readAt).length;

  return (
    <div>
      <div className="flex items-center justify-between px-2 pb-2 pt-1.5">
        <span className="text-sm font-medium text-fg">Notifications</span>
        <button type="button" onClick={onMarkAllRead} disabled={!unread} className="text-xs text-accent hover:underline disabled:text-faint disabled:no-underline">
          Mark all read
        </button>
      </div>
      <div className="-mx-1 max-h-80 overflow-y-auto border-t border-line px-1 pt-1">
        {status === 'error' && (
          <div className="flex flex-col items-center px-4 py-8 text-center" role="alert">
            <TriangleAlert className="mb-2 h-5 w-5 text-danger" aria-hidden />
            <p className="text-sm font-medium text-fg">Couldn’t load notifications</p>
            <p className="mt-1 text-xs text-muted">{error}</p>
          </div>
        )}
        {(status === 'loading' || status === 'idle') && <p className="px-4 py-8 text-center text-xs text-muted">Loading…</p>}
        {status === 'ready' && items.length === 0 && (
          <div className="flex flex-col items-center px-4 py-8 text-center">
            <Bell className="mb-2 h-5 w-5 text-faint" aria-hidden />
            <p className="text-sm font-medium text-fg">No notifications yet</p>
            <p className="mt-1 text-xs text-muted">You’ll see a notification here when a monitor goes down or recovers.</p>
          </div>
        )}
        {status === 'ready' && items.map((n) => {
          const Icon = n.resolved ? CircleCheck : TriangleAlert;
          return (
            <button
              key={n.id}
              type="button"
              role="menuitem"
              onClick={() => {
                navigate(`/incidents?id=${n.id}`);
                close();
              }}
              className="flex w-full gap-3 rounded-md px-2 py-2 text-left outline-none hover:bg-hover focus-visible:bg-hover"
            >
              <Icon className={cn('mt-0.5 h-4 w-4 shrink-0', n.resolved ? 'text-success' : 'text-danger')} aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm text-fg">{n.title}</span>
                <span className="mt-0.5 line-clamp-2 block text-xs text-muted">{n.detail}</span>
                <span className="mt-1 block text-2xs text-faint">{formatRelative(n.at, now)}</span>
              </span>
              {n.at > readAt && <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" aria-label="Unread" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function NotificationsMenu() {
  const { incidents, incidentsStatus, incidentsError } = useApp();
  // Remembered per browser so notifications already seen stay read after a reload.
  const [readAt, setReadAt] = useLocalStorage('pm.notificationsReadAt', 0);
  const items = buildNotifications(incidents);
  const unread = items.filter((n) => n.at > readAt).length;

  return (
    <Dropdown
      width={360}
      trigger={({ open, ...props }) => (
        <button
          {...props}
          type="button"
          aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`}
          className={cn(
            'focus-ring relative flex h-8 w-8 items-center justify-center rounded-md text-muted transition-colors hover:bg-hover hover:text-fg',
            open && 'bg-hover text-fg',
          )}
        >
          <Bell className="h-4 w-4" />
          {unread > 0 && <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-danger ring-2 ring-bg" />}
        </button>
      )}
    >
      <NotificationList
        items={items}
        readAt={readAt}
        status={incidentsStatus}
        error={incidentsError}
        onMarkAllRead={() => setReadAt(Date.now())}
      />
    </Dropdown>
  );
}
