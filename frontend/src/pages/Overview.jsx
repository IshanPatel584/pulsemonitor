import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, BarChart3, CircleCheck, Gauge, Plus, Server, TriangleAlert } from 'lucide-react';
import ChartStatus from '../components/charts/ChartStatus';
import MonitorSelect from '../components/charts/MonitorSelect';
import ResponseTimeChart, { ResponseTimeLegend } from '../components/charts/ResponseTimeChart';
import UptimeChart from '../components/charts/UptimeChart';
import IncidentList from '../components/incidents/IncidentList';
import PageHeader from '../components/layout/PageHeader';
import MonitorTable from '../components/monitors/MonitorTable';
import Button from '../components/ui/Button';
import { Card, CardBody, CardHeader } from '../components/ui/Card';
import EmptyState from '../components/ui/EmptyState';
import ErrorState from '../components/ui/ErrorState';
import StatCard from '../components/ui/StatCard';
import { useApp } from '../context/AppContext';
import { useMonitorHistory } from '../hooks/useMonitorHistory';
import { useNow } from '../hooks/useNow';
import { checksBetween, dailyUptime, fitDomain, responseSeries, uptimePercent } from '../lib/history';
import { countByStatus, sortMonitors } from '../lib/monitors';

const OVERVIEW_ROWS = 6;
const DAY = 24 * 60 * 60 * 1000;

/** Response-time (24h) and daily uptime (7d) charts for one monitor, from its check history. */
function MonitorHistoryCharts({ monitors, monitorsStatus, monitorsError, onRetryMonitors }) {
  const [monitorId, setMonitorId] = useState(null);
  const monitor = monitors.find((m) => m.id === monitorId) ?? null;
  const history = useMonitorHistory(monitor?.id, monitor?.lastChecked);
  const now = useNow(60_000);

  const last24h = [now - DAY, now];
  const response = responseSeries(checksBetween(history.checks, last24h[0], last24h[1]), { from: last24h[0], to: last24h[1] });
  const domain = fitDomain(response.data, last24h[0], last24h[1]);
  const days = dailyUptime(history.checks, { days: 7, now });
  const weekChecks = checksBetween(history.checks, days[0].time, now);
  const weekUptime = uptimePercent(weekChecks);

  // The monitor list's own state wins: no point loading history until it has loaded.
  const noMonitors = monitorsStatus === 'ready' && monitors.length === 0;
  const status = monitorsStatus === 'ready' ? (noMonitors ? 'ready' : history.status) : monitorsStatus === 'error' ? 'error' : 'loading';
  const error = monitorsStatus === 'error' ? monitorsError : history.error;
  const retry = monitorsStatus === 'error' ? onRetryMonitors : () => history.reload();
  const subject = monitor ? monitor.name : 'No monitor selected';

  return (
    <div className="stagger-children mt-4 grid grid-cols-1 gap-4 xl:grid-cols-5">
      <Card className="xl:col-span-3">
        <CardHeader
          title="Response time"
          description={`${subject} · last 24 hours`}
          action={
            <>
              {response.data.length > 0 && <ResponseTimeLegend bucketed={response.bucketed} />}
              <MonitorSelect id="overview-chart-monitor" monitors={monitors} value={monitorId} onChange={setMonitorId} />
            </>
          }
        />
        <CardBody>
          <ChartStatus
            status={status}
            error={error}
            onRetry={retry}
            empty={noMonitors || response.data.length === 0}
            emptyTitle={noMonitors ? 'No monitors yet' : 'No response times in the last 24 hours'}
            emptyDescription={
              noMonitors
                ? 'Add a monitor to start recording checks.'
                : 'Points appear after checks that receive an HTTP response.'
            }
          >
            <ResponseTimeChart data={response.data} domain={domain} bucketed={response.bucketed} />
          </ChartStatus>
        </CardBody>
      </Card>
      <Card className="xl:col-span-2">
        <CardHeader
          title="Uptime"
          description={`${subject} · last 7 days`}
          action={
            weekUptime != null && history.status === 'ready' && (
              <span className="font-mono text-sm tabular-nums text-fg" title={`${weekChecks.filter((c) => c.success).length} of ${weekChecks.length} checks succeeded`}>
                {weekUptime.toFixed(2)}%
              </span>
            )
          }
        />
        <CardBody>
          <ChartStatus
            status={status}
            error={error}
            onRetry={retry}
            empty={noMonitors || weekChecks.length === 0}
            emptyIcon={BarChart3}
            emptyTitle={noMonitors ? 'No monitors yet' : 'No checks in the last 7 days'}
            emptyDescription={noMonitors ? 'Add a monitor to start recording checks.' : 'Daily uptime appears once this monitor has been checked.'}
          >
            <UptimeChart data={days} />
          </ChartStatus>
        </CardBody>
      </Card>
    </div>
  );
}

export default function Overview() {
  const { monitors, monitorsStatus, monitorsError, refreshMonitors, incidents, incidentsStatus, incidentsError, refreshIncidents, openAddMonitor } = useApp();
  const navigate = useNavigate();
  const [sort, setSort] = useState(null);
  const loading = monitorsStatus === 'loading' || monitorsStatus === 'idle';

  const counts = countByStatus(monitors);
  const incidentsLoading = incidentsStatus === 'loading' || incidentsStatus === 'idle';
  const openIncidents = incidents.filter((i) => i.status === 'open');
  const affectedMonitors = new Set(openIncidents.map((i) => i.monitorId)).size;
  const responding = monitors.filter((m) => m.responseTime != null);
  const avgResponse = responding.length
    ? Math.round(responding.reduce((sum, m) => sum + m.responseTime, 0) / responding.length)
    : null;

  const rows = (sort ? sortMonitors(monitors, sort) : monitors).slice(0, OVERVIEW_ROWS);
  const recentIncidents = incidents.slice(0, 4); // API returns newest first

  return (
    <>
      <PageHeader description="Health of your monitored endpoints.">
        <Button variant="primary" icon={Plus} onClick={openAddMonitor}>
          Add Monitor
        </Button>
      </PageHeader>

      <div className="stagger-children grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        <StatCard
          label="Total monitors"
          value={monitors.length}
          icon={Server}
          loading={loading}
          hint={
            monitors.length === 0
              ? 'Add one to get started'
              : counts.unknown
                ? `${counts.unknown} with unknown status`
                : 'All monitors reporting'
          }
        />
        <StatCard
          label="Operational"
          value={counts.up}
          unit={`/ ${monitors.length}`}
          icon={CircleCheck}
          tone="success"
          loading={loading}
          hint={counts.down ? `${counts.down} currently down` : 'No monitors down'}
        />
        <StatCard
          label="Active incidents"
          value={incidentsStatus === 'error' ? '—' : openIncidents.length}
          icon={TriangleAlert}
          tone={openIncidents.length ? 'danger' : 'default'}
          loading={incidentsLoading}
          hint={
            incidentsStatus === 'error'
              ? 'Couldn’t load incidents'
              : openIncidents.length
                ? `Affecting ${affectedMonitors} monitor${affectedMonitors === 1 ? '' : 's'}`
                : 'No open incidents'
          }
        />
        <StatCard
          label="Avg response time"
          value={avgResponse ?? '—'}
          unit={avgResponse != null ? 'ms' : undefined}
          icon={Gauge}
          loading={loading}
          hint={avgResponse != null ? `Across ${responding.length} responding monitors` : 'No monitoring history yet'}
        />
      </div>

      <MonitorHistoryCharts
        monitors={monitors}
        monitorsStatus={monitorsStatus}
        monitorsError={monitorsError}
        onRetryMonitors={() => refreshMonitors().catch(() => {})}
      />

      <Card className="mt-4">
        <CardHeader
          title="Monitors"
          description={loading ? 'Loading…' : `Showing ${rows.length} of ${monitors.length}`}
          action={
            <Link to="/monitors" className="focus-ring inline-flex items-center gap-1 rounded text-xs font-medium text-muted hover:text-fg">
              View all <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          }
        />
        <div className="mt-3 border-t border-line">
          {monitorsStatus === 'error' ? (
            <ErrorState title="Couldn’t load monitors" message={monitorsError} onRetry={() => refreshMonitors().catch(() => {})} />
          ) : (
            <MonitorTable
              monitors={rows}
              sort={sort}
              onSortChange={setSort}
              loading={loading}
              skeletonRows={4}
              empty={
                <EmptyState
                  icon={Server}
                  title="No monitors yet"
                  description="Add an endpoint to start tracking its status."
                  action={
                    <Button size="sm" variant="primary" icon={Plus} onClick={openAddMonitor}>
                      Add Monitor
                    </Button>
                  }
                />
              }
            />
          )}
        </div>
      </Card>

      <Card className="mt-4">
        <CardHeader
          title="Recent incidents"
          description={incidentsLoading ? 'Loading…' : incidentsStatus === 'error' ? 'Couldn’t load incidents' : `${openIncidents.length} open`}
          action={
            <Link to="/incidents" className="focus-ring inline-flex items-center gap-1 rounded text-xs font-medium text-muted hover:text-fg">
              All incidents <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          }
        />
        <div className="mt-3 border-t border-line">
          {incidentsStatus === 'error' ? (
            <ErrorState title="Couldn’t load incidents" message={incidentsError} onRetry={() => refreshIncidents().catch(() => {})} />
          ) : incidentsLoading ? (
            <div className="space-y-2 px-4 py-4 sm:px-5" aria-busy="true" aria-label="Loading incidents">
              {Array.from({ length: 3 }, (_, i) => (
                <div key={i} className="h-12 skeleton rounded-md bg-hover/60" />
              ))}
            </div>
          ) : recentIncidents.length ? (
            <IncidentList incidents={recentIncidents} onSelect={(inc) => navigate(`/incidents?id=${inc.id}`)} />
          ) : (
            <EmptyState
              icon={CircleCheck}
              title="No incidents yet"
              description="An incident opens automatically when a monitor’s check fails, and resolves when it passes again."
            />
          )}
        </div>
      </Card>
    </>
  );
}
