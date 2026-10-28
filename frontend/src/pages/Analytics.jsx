import { useState } from 'react';
import { BarChart3, Gauge, TriangleAlert } from 'lucide-react';
import ChartEmptyState from '../components/charts/ChartEmptyState';
import ChartStatus from '../components/charts/ChartStatus';
import MonitorSelect from '../components/charts/MonitorSelect';
import ResponseTimeChart, { ResponseTimeLegend } from '../components/charts/ResponseTimeChart';
import UptimeChart from '../components/charts/UptimeChart';
import PageHeader from '../components/layout/PageHeader';
import { Card, CardBody, CardHeader } from '../components/ui/Card';
import ErrorState from '../components/ui/ErrorState';
import SegmentedControl from '../components/ui/SegmentedControl';
import StatCard from '../components/ui/StatCard';
import { useApp } from '../context/AppContext';
import { useMonitorHistory } from '../hooks/useMonitorHistory';
import { useNow } from '../hooks/useNow';
import { checksBetween, fitDomain, rangeByValue, responseSeries, responseStats, TIME_RANGES, trimLeadingEmpty, uptimeBuckets, uptimePercent } from '../lib/history';
import { displayUrl, formatMs, responseTone } from '../lib/format';
import { countByStatus } from '../lib/monitors';
import { cn } from '../lib/cn';

// The backend keeps check results for 30 days, so longer ranges show at most that much.
const RETENTION_NOTE = 'Check history is kept for 30 days.';

/** Ranks monitors by their latest reported response time (only monitors that report one). */
function SlowestEndpoints({ monitors }) {
  const items = monitors
    .filter((m) => m.responseTime != null)
    .sort((a, b) => b.responseTime - a.responseTime)
    .slice(0, 6);

  if (!items.length) {
    return (
      <ChartEmptyState
        height={200}
        icon={Gauge}
        title="No response-time data yet"
        description="Endpoints will be ranked here once checks record response times."
      />
    );
  }

  const max = Math.max(...items.map((i) => i.responseTime), 1);
  return (
    <ul className="space-y-3.5">
      {items.map((item) => (
        <li key={item.id}>
          <div className="flex items-baseline justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm text-fg">{item.name}</p>
              <p className="truncate font-mono text-2xs text-muted">{displayUrl(item.url)}</p>
            </div>
            <span className={cn('shrink-0 font-mono text-xs tabular-nums', responseTone(item.responseTime))}>{formatMs(item.responseTime)}</span>
          </div>
          <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-hover">
            <div
              className={cn('h-full rounded-full', item.responseTime >= 800 ? 'bg-danger/80' : item.responseTime >= 500 ? 'bg-warning/80' : 'bg-accent/80')}
              style={{ width: `${(item.responseTime / max) * 100}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

export default function Analytics() {
  const { monitors, monitorsStatus, monitorsError, refreshMonitors, incidents, incidentsStatus } = useApp();
  const [rangeValue, setRangeValue] = useState('7d');
  const [monitorId, setMonitorId] = useState(null);
  const range = rangeByValue(rangeValue);
  const loading = monitorsStatus === 'loading' || monitorsStatus === 'idle';
  const counts = countByStatus(monitors);

  const monitor = monitors.find((m) => m.id === monitorId) ?? null;
  const history = useMonitorHistory(monitor?.id, monitor?.lastChecked);
  const now = useNow(60_000);
  const from = now - range.ms;
  const inRange = checksBetween(history.checks, from, now);

  const uptime = uptimePercent(inRange);
  const rangeIncidents = incidents.filter((i) => i.monitorId === monitor?.id && i.startedAt >= from);
  const rangeOpen = rangeIncidents.filter((i) => i.status === 'open').length;
  const stats = responseStats(inRange);
  const response = responseSeries(inRange, { from, to: now, maxPoints: 200 });
  const uptimeSeries = trimLeadingEmpty(uptimeBuckets(inRange, { from, to: now, count: range.buckets, label: range.bucketLabel }));

  const noMonitors = monitorsStatus === 'ready' && monitors.length === 0;
  const chartStatus = monitorsStatus === 'ready' ? (noMonitors ? 'ready' : history.status) : monitorsStatus === 'error' ? 'error' : 'loading';
  const chartError = monitorsStatus === 'error' ? monitorsError : history.error;
  const retry = monitorsStatus === 'error' ? () => refreshMonitors().catch(() => {}) : () => history.reload();
  const historyReady = chartStatus === 'ready' && !noMonitors;
  const subject = monitor?.name ?? 'No monitor selected';
  const emptyCopy = noMonitors
    ? { title: 'No monitors yet', description: 'Add a monitor to start recording checks.' }
    : null;

  return (
    <>
      <PageHeader description={`${subject} · ${range.text}. ${RETENTION_NOTE}`}>
        <MonitorSelect id="analytics-monitor" monitors={monitors} value={monitorId} onChange={setMonitorId} />
        <SegmentedControl label="Time range" options={TIME_RANGES} value={rangeValue} onChange={setRangeValue} />
      </PageHeader>

      <div className="stagger-children grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        <StatCard
          label="Average uptime"
          value={historyReady && uptime != null ? uptime.toFixed(2) : '—'}
          unit={historyReady && uptime != null ? '%' : undefined}
          loading={chartStatus === 'loading'}
          hint={historyReady && inRange.length ? `${inRange.filter((c) => c.success).length} of ${inRange.length} checks succeeded` : `No checks in the ${range.text}`}
        />
        <StatCard
          label="Avg response"
          value={historyReady && stats ? stats.avg : '—'}
          unit={historyReady && stats ? 'ms' : undefined}
          loading={chartStatus === 'loading'}
          hint={historyReady && stats ? `p95 ${stats.p95} ms · ${stats.count} responses` : 'No response times recorded'}
        />
        <StatCard
          label="Incidents"
          value={incidentsStatus === 'error' || !monitor ? '—' : rangeIncidents.length}
          tone={rangeOpen ? 'danger' : 'default'}
          loading={incidentsStatus === 'loading' || incidentsStatus === 'idle'}
          hint={
            incidentsStatus === 'error'
              ? 'Couldn’t load incidents'
              : rangeIncidents.length
                ? `${rangeOpen} open · started in the ${range.text}`
                : `None started in the ${range.text}`
          }
        />
        <StatCard
          label="Monitors"
          value={monitors.length}
          loading={loading}
          hint={`${counts.up} up · ${counts.down} down · ${counts.unknown} unknown`}
        />
      </div>

      <div className="stagger-children mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader title="Uptime trend" description={`${subject} · ${range.text}`} />
          <CardBody>
            <ChartStatus
              status={chartStatus}
              error={chartError}
              onRetry={retry}
              height={260}
              empty={noMonitors || inRange.length === 0}
              emptyIcon={BarChart3}
              emptyTitle={emptyCopy?.title ?? `No checks in the ${range.text}`}
              emptyDescription={emptyCopy?.description ?? 'Uptime is calculated from successful checks ÷ all checks in each period.'}
            >
              <UptimeChart data={uptimeSeries} variant="line" height={260} />
            </ChartStatus>
          </CardBody>
        </Card>
        <Card>
          <CardHeader
            title="Response time trend"
            description={`${subject} · ${range.text}`}
            action={historyReady && response.data.length > 0 && <ResponseTimeLegend bucketed={response.bucketed} />}
          />
          <CardBody>
            <ChartStatus
              status={chartStatus}
              error={chartError}
              onRetry={retry}
              height={260}
              empty={noMonitors || response.data.length === 0}
              emptyTitle={emptyCopy?.title ?? `No response times in the ${range.text}`}
              emptyDescription={emptyCopy?.description ?? 'Only checks that received an HTTP response have a response time.'}
            >
              <ResponseTimeChart data={response.data} domain={fitDomain(response.data, from, now)} bucketed={response.bucketed} height={260} />
            </ChartStatus>
          </CardBody>
        </Card>
      </div>

      <div className="stagger-children mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader title="Slowest endpoints" description="Ranked by latest response time" />
          <CardBody className="pt-4">
            {monitorsStatus === 'error' ? (
              <ErrorState title="Couldn’t load monitors" message={monitorsError} onRetry={() => refreshMonitors().catch(() => {})} />
            ) : loading ? (
              <div className="h-[200px] skeleton rounded-md bg-hover/60" aria-busy="true" aria-label="Loading" />
            ) : (
              <SlowestEndpoints monitors={monitors} />
            )}
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Most frequently failing" description="Failed checks in the selected range" />
          <CardBody className="pt-4">
            <ChartEmptyState
              height={200}
              icon={TriangleAlert}
              title="Not available yet"
              description="Ranking needs failure counts for every monitor, and the API only returns history one monitor at a time."
            />
          </CardBody>
        </Card>
      </div>
    </>
  );
}
