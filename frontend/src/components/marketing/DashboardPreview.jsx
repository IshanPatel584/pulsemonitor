import { CircleCheck, TriangleAlert } from 'lucide-react';
import ResponseTimeChart, { ResponseTimeLegend } from '../charts/ResponseTimeChart';
import UptimeChart from '../charts/UptimeChart';
import StatusBadge from '../ui/StatusBadge';
import { cn } from '../../lib/cn';
import DemoBadge from './DemoBadge';
import {
  DEMO_INCIDENTS,
  DEMO_MONITORS,
  DEMO_RESPONSE_DOMAIN,
  DEMO_RESPONSE_SERIES,
  DEMO_STATS,
  DEMO_UPTIME_DAYS,
} from './demoData';

function Panel({ title, className, children, action }) {
  return (
    <div className={cn('min-w-0 rounded-lg border border-line bg-surface', className)}>
      <div className="flex items-center justify-between gap-2 px-3.5 pt-3">
        <p className="truncate text-xs font-medium text-fg">{title}</p>
        {action}
      </div>
      {children}
    </div>
  );
}

function Stats({ items }) {
  return (
    <div className={cn('grid grid-cols-2 gap-2.5', items.length > 2 && 'md:grid-cols-4')}>
      {items.map((s) => (
        <div key={s.label} className="rounded-lg border border-line bg-surface px-3.5 py-3">
          <p className="text-2xs font-medium text-muted">{s.label}</p>
          <p className="mt-1.5 flex items-baseline gap-1">
            <span className={cn('text-xl font-semibold tabular-nums tracking-tight', s.tone === 'danger' ? 'text-danger' : 'text-fg')}>{s.value}</span>
            {s.unit && <span className="text-xs text-muted">{s.unit}</span>}
          </p>
          <p className="mt-0.5 truncate text-2xs text-faint">{s.hint}</p>
        </div>
      ))}
    </div>
  );
}

function MonitorList({ items }) {
  return (
    <ul className="mt-2 divide-y divide-line">
      {items.map((m) => (
        <li key={m.name} className="flex items-center gap-3 px-3.5 py-2.5">
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium text-fg">{m.name}</p>
            <p className="truncate font-mono text-2xs text-muted">
              <span className="text-faint">{m.method}</span> {m.url}
            </p>
          </div>
          <StatusBadge status={m.status} className="h-5 px-1.5 text-2xs" />
          <span className={cn('w-12 text-right font-mono text-2xs tabular-nums', m.status === 'down' ? 'text-danger' : 'text-fg')}>{m.response}</span>
        </li>
      ))}
    </ul>
  );
}

function IncidentTimeline({ items }) {
  return (
    <ol className="relative mx-3.5 mb-3 mt-3 space-y-3 before:absolute before:bottom-1 before:left-[5px] before:top-1 before:w-px before:bg-line">
      {items.map((inc) => {
        const open = inc.status === 'open';
        const Icon = open ? TriangleAlert : CircleCheck;
        return (
          <li key={`${inc.monitor}-${inc.time}`} className="relative flex gap-3 pl-5">
            <span
              className={cn('absolute left-0 top-1 h-[11px] w-[11px] rounded-full ring-4 ring-surface', open ? 'bg-danger' : 'bg-success')}
              aria-hidden
            />
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-1.5 text-xs font-medium text-fg">
                <Icon className={cn('h-3 w-3 shrink-0', open ? 'text-danger' : 'text-success')} aria-hidden />
                <span className="truncate">{inc.monitor}</span>
                <span className="ml-auto shrink-0 font-mono text-2xs font-normal text-faint">{inc.time}</span>
              </p>
              <p className="mt-0.5 truncate text-2xs text-muted">
                {inc.reason}
                {inc.duration && <span className="text-faint"> · resolved in {inc.duration}</span>}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/**
 * Static product preview built from the app's own chart and status components.
 * Every value is illustrative (see demoData.js) and the frame is labelled "Demo data".
 *
 * variant="full"    — landing hero: stats, response chart, uptime bars, monitors, incidents
 * variant="compact" — auth pages: stats, response chart, incident timeline
 */
export default function DashboardPreview({ variant = 'full', className }) {
  const compact = variant === 'compact';

  return (
    <figure
      className={cn('relative rounded-2xl border border-line bg-bg/80 p-2.5 shadow-popover backdrop-blur sm:p-3', className)}
      aria-label="PulseMonitor dashboard preview with demo data"
    >
      <div className="flex items-center gap-3 px-1.5 pb-2.5 pt-0.5">
        <div className="flex gap-1.5" aria-hidden>
          <span className="h-2.5 w-2.5 rounded-full bg-line-strong" />
          <span className="h-2.5 w-2.5 rounded-full bg-line-strong" />
          <span className="h-2.5 w-2.5 rounded-full bg-line-strong" />
        </div>
        <span className="truncate text-2xs font-medium text-muted">PulseMonitor · Overview</span>
        <DemoBadge className="ml-auto" />
      </div>

      <div className="space-y-2.5">
        <Stats items={compact ? DEMO_STATS.slice(0, 2) : DEMO_STATS} />

        <div className={cn('grid grid-cols-1 gap-2.5', !compact && 'lg:grid-cols-5')}>
          <Panel title="Response time · Checkout API" className={cn(!compact && 'lg:col-span-3')} action={<ResponseTimeLegend />}>
            <div className="px-1.5 pb-2 pt-1">
              <ResponseTimeChart data={DEMO_RESPONSE_SERIES} domain={DEMO_RESPONSE_DOMAIN} height={compact ? 150 : 190} />
            </div>
          </Panel>
          {!compact && (
            <Panel title="Uptime · last 7 days" className="lg:col-span-2" action={<span className="font-mono text-2xs text-muted">99.81%</span>}>
              <div className="px-1.5 pb-2 pt-1">
                <UptimeChart data={DEMO_UPTIME_DAYS} height={190} />
              </div>
            </Panel>
          )}
        </div>

        <div className={cn('grid grid-cols-1 gap-2.5', !compact && 'md:grid-cols-2')}>
          {!compact && (
            <Panel title="Monitors">
              <MonitorList items={DEMO_MONITORS} />
            </Panel>
          )}
          <Panel title="Incident timeline">
            <IncidentTimeline items={compact ? DEMO_INCIDENTS.slice(0, 2) : DEMO_INCIDENTS} />
          </Panel>
        </div>
      </div>
      <figcaption className="sr-only">Illustrative preview. All values are demo data, not live monitoring results.</figcaption>
    </figure>
  );
}
