import { useNow } from '../../hooks/useNow';
import { formatDuration, formatRelative } from '../../lib/format';
import { cn } from '../../lib/cn';
import IncidentStatusBadge from './IncidentStatusBadge';

export function incidentDuration(incident, now) {
  return (incident.resolvedAt ?? now) - incident.startedAt;
}

export const incidentMonitorName = (incident) => incident.monitorName ?? 'Deleted monitor';

export default function IncidentList({ incidents, selectedId, onSelect }) {
  const now = useNow(15_000);

  return (
    <ul className="divide-y divide-line">
      {incidents.map((inc) => {
        const selected = inc.id === selectedId;
        const open = inc.status === 'open';
        return (
          <li key={inc.id} className="animate-fade-in">
            <button
              type="button"
              onClick={() => onSelect?.(inc)}
              aria-current={selected ? 'true' : undefined}
              className={cn(
                'focus-ring relative flex w-full gap-3 px-4 py-3 text-left transition-colors sm:px-5',
                selected ? 'bg-hover' : 'hover:bg-hover/50',
              )}
            >
              <span className={cn('mt-1 h-8 w-0.5 shrink-0 rounded-full', open ? 'bg-danger' : 'bg-success opacity-40')} aria-hidden />
              <span className="min-w-0 flex-1">
                <span className={cn('block truncate text-sm font-medium', inc.monitorName ? 'text-fg' : 'text-muted')}>
                  {incidentMonitorName(inc)}
                </span>
                <span className="mt-0.5 block truncate text-xs text-muted" title={inc.reason}>
                  {inc.reason}
                </span>
                <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-faint">
                  <span>Started {formatRelative(inc.startedAt, now)}</span>
                  {inc.resolvedAt && (
                    <>
                      <span>·</span>
                      <span>Resolved {formatRelative(inc.resolvedAt, now)}</span>
                    </>
                  )}
                </span>
              </span>
              <span className="flex shrink-0 flex-col items-end gap-1.5">
                <IncidentStatusBadge status={inc.status} />
                <span className={cn('font-mono text-xs tabular-nums', open ? 'text-danger' : 'text-muted')}>
                  {formatDuration(incidentDuration(inc, now))}
                </span>
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
