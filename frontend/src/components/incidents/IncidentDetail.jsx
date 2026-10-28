import { Link } from 'react-router-dom';
import { useNow } from '../../hooks/useNow';
import { displayUrl, formatDateTime, formatDuration } from '../../lib/format';
import { cn } from '../../lib/cn';
import { incidentDuration, incidentMonitorName } from './IncidentList';
import IncidentStatusBadge from './IncidentStatusBadge';

function Meta({ label, children }) {
  return (
    <div>
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="mt-0.5 text-sm text-fg">{children}</dd>
    </div>
  );
}

/** Details for one incident. Every value comes from the incident document itself. */
export default function IncidentDetail({ incident, hideTitle = false }) {
  const now = useNow(15_000);
  const open = incident.status === 'open';

  // Built only from recorded timestamps: when the incident opened, and when it resolved.
  const events = [
    incident.resolvedAt && { at: incident.resolvedAt, label: 'Resolved', message: 'A check matched the expected status again.', dot: 'bg-success' },
    { at: incident.startedAt, label: 'Opened', message: incident.reason, dot: 'bg-danger' },
  ].filter(Boolean);

  return (
    <div className="space-y-6 p-5">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <IncidentStatusBadge status={incident.status} />
          <span className="ml-auto font-mono text-xs text-faint" title={incident.id}>
            #{String(incident.id).slice(-6)}
          </span>
        </div>
        {!hideTitle && <h2 className="mt-3 text-base font-semibold text-fg">{incidentMonitorName(incident)}</h2>}
        <p className="mt-2 text-sm leading-relaxed text-muted">{incident.reason}</p>
      </div>

      <dl className="grid grid-cols-2 gap-x-6 gap-y-4 rounded-lg border border-line p-4">
        <Meta label="Affected monitor">
          {incident.monitorName ? (
            <Link to={`/monitors?q=${encodeURIComponent(incident.monitorName)}`} className="text-accent hover:underline">
              {incident.monitorName}
            </Link>
          ) : (
            <span className="text-muted">Deleted monitor</span>
          )}
        </Meta>
        <Meta label="Status">{open ? 'Open' : 'Resolved'}</Meta>
        <Meta label="Started">{formatDateTime(incident.startedAt)}</Meta>
        <Meta label="Resolved">{incident.resolvedAt ? formatDateTime(incident.resolvedAt) : <span className="text-muted">—</span>}</Meta>
        <Meta label={open ? 'Open for' : 'Duration'}>
          <span className="font-mono tabular-nums">{formatDuration(incidentDuration(incident, now))}</span>
        </Meta>
        <Meta label="Endpoint">
          {incident.monitorUrl ? (
            <span className="break-all font-mono text-xs">{displayUrl(incident.monitorUrl)}</span>
          ) : (
            <span className="text-muted">—</span>
          )}
        </Meta>
      </dl>

      <div>
        <h3 className="text-xs font-medium text-muted">Timeline</h3>
        <ol className="relative mt-3 space-y-4 before:absolute before:bottom-1 before:left-[3px] before:top-1 before:w-px before:bg-line">
          {events.map((event) => (
            <li key={event.label} className="relative flex gap-3 pl-5">
              <span className={cn('absolute left-0 top-1.5 h-[7px] w-[7px] rounded-full ring-4 ring-surface', event.dot)} aria-hidden />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-xs font-medium text-fg">{event.label}</span>
                  <time className="shrink-0 font-mono text-2xs text-faint" dateTime={new Date(event.at).toISOString()}>
                    {formatDateTime(event.at)}
                  </time>
                </div>
                <p className="mt-0.5 text-xs leading-relaxed text-muted">{event.message}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
