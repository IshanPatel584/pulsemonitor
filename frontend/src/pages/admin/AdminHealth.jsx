import { useEffect, useState } from 'react';
import { Activity, Database, RefreshCw, Server } from 'lucide-react';
import { DetailList, ResourceError } from '../../components/admin/AdminUI';
import PageHeader from '../../components/layout/PageHeader';
import Button from '../../components/ui/Button';
import { Card, CardBody, CardHeader } from '../../components/ui/Card';
import { useAdminResource } from '../../hooks/useAdminResource';
import { useNow } from '../../hooks/useNow';
import { adminApi } from '../../lib/api';
import { cn } from '../../lib/cn';
import { formatDateTime, formatDuration, formatNumber, formatRelative } from '../../lib/format';

const REFRESH_MS = 30_000;

const formatBytes = (bytes) => `${(bytes / 1024 / 1024).toFixed(0)} MB`;

function Indicator({ tone, children }) {
  const styles = {
    ok: 'border-success/25 bg-success/10 text-success',
    warn: 'border-warning/30 bg-warning/10 text-warning',
    bad: 'border-danger/25 bg-danger/10 text-danger',
  }[tone];
  const dot = { ok: 'bg-success', warn: 'bg-warning', bad: 'bg-danger' }[tone];
  return (
    <span className={cn('inline-flex h-6 items-center gap-1.5 rounded-full border px-2 text-xs font-medium', styles)}>
      <span className={cn('h-1.5 w-1.5 rounded-full', dot)} aria-hidden />
      {children}
    </span>
  );
}

function HealthCard({ icon: Icon, title, indicator, items }) {
  return (
    <Card>
      <CardHeader
        title={
          <span className="flex items-center gap-2">
            <Icon className="h-4 w-4 text-faint" aria-hidden /> {title}
          </span>
        }
        action={indicator}
      />
      <CardBody className="pt-1">
        <DetailList items={items} />
      </CardBody>
    </Card>
  );
}

export default function AdminHealth() {
  const [tick, setTick] = useState(0);
  const health = useAdminResource(adminApi.health, tick);
  const now = useNow(10_000);

  // Light auto-refresh while the page is open and visible.
  useEffect(() => {
    const id = setInterval(() => {
      if (!document.hidden) setTick((t) => t + 1);
    }, REFRESH_MS);
    return () => clearInterval(id);
  }, []);

  const h = health.data;

  return (
    <>
      <PageHeader description={h ? `Live status of this backend instance. Updated ${formatRelative(Date.parse(h.checkedAt), now)}; refreshes every 30 seconds.` : 'Live status of this backend instance.'}>
        <Button size="sm" icon={RefreshCw} onClick={() => setTick((t) => t + 1)} disabled={health.refreshing} className={health.refreshing ? '[&>svg]:animate-spin' : undefined}>
          Refresh
        </Button>
      </PageHeader>

      {health.status === 'error' ? (
        <Card>
          <ResourceError
            resource={health}
            title={health.error?.includes('reach') ? 'The backend isn’t responding' : 'Couldn’t load system health'}
          />
        </Card>
      ) : !h ? (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-72 skeleton rounded-lg border border-line bg-hover/40" />
          ))}
        </div>
      ) : (
        <div className="stagger-children grid grid-cols-1 gap-3 lg:grid-cols-3">
          <HealthCard
            icon={Database}
            title="Database"
            indicator={
              <Indicator tone={h.database.state === 'connected' ? 'ok' : 'bad'}>
                {h.database.state === 'connected' ? 'Connected' : h.database.state}
              </Indicator>
            }
            items={[
              ['Connection', h.database.state],
              ['Ping', h.database.pingMs == null ? '—' : `${h.database.pingMs} ms`],
            ]}
          />
          <HealthCard
            icon={Activity}
            title="Monitoring engine"
            indicator={
              !h.scheduler.running ? (
                <Indicator tone="bad">Stopped</Indicator>
              ) : h.scheduler.overdueMonitors > 0 ? (
                <Indicator tone="warn">Running, behind</Indicator>
              ) : (
                <Indicator tone="ok">Running</Indicator>
              )
            }
            items={[
              ['Scheduler', h.scheduler.running ? `Running (every ${h.scheduler.tickSeconds}s)` : 'Not running'],
              ['Checks in flight', `${h.scheduler.checksInFlight} of ${h.scheduler.maxConcurrentChecks} max`],
              ['Last check', h.scheduler.lastCheckAt ? `${formatRelative(Date.parse(h.scheduler.lastCheckAt), now)} · ${formatDateTime(Date.parse(h.scheduler.lastCheckAt))}` : 'No checks recorded'],
              ['Checks in the last hour', formatNumber(h.scheduler.checksLastHour)],
              [
                'Overdue monitors',
                <span className={h.scheduler.overdueMonitors ? 'text-warning' : undefined}>
                  {h.scheduler.overdueMonitors} of {h.scheduler.totalMonitors}
                </span>,
              ],
            ]}
          />
          <HealthCard
            icon={Server}
            title="API server"
            indicator={<Indicator tone="ok">Responding</Indicator>}
            items={[
              ['Uptime', formatDuration(h.server.uptimeSeconds * 1000)],
              ['Node.js', h.server.nodeVersion],
              ['Memory (RSS)', formatBytes(h.server.memory.rssBytes)],
              ['Heap used', `${formatBytes(h.server.memory.heapUsedBytes)} of ${formatBytes(h.server.memory.heapTotalBytes)}`],
            ]}
          />
          <p className="text-xs text-faint lg:col-span-3">
            A monitor is overdue when it has never been checked or its last check is older than twice its interval plus a minute.
            With several backend instances, each reports only its own scheduler and process.
          </p>
        </div>
      )}
    </>
  );
}
