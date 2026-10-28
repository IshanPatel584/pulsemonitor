import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Activity, CheckCircle2, Server, TriangleAlert, UserPlus, Users } from 'lucide-react';
import { ChecksChart, IncidentsChart, RegistrationsChart, ResponseTrendChart, StatusDonut } from '../../components/admin/AdminCharts';
import { ResourceError, RoleBadge } from '../../components/admin/AdminUI';
import ChartEmptyState from '../../components/charts/ChartEmptyState';
import IncidentStatusBadge from '../../components/incidents/IncidentStatusBadge';
import PageHeader from '../../components/layout/PageHeader';
import Button from '../../components/ui/Button';
import { Card, CardBody, CardHeader } from '../../components/ui/Card';
import SegmentedControl from '../../components/ui/SegmentedControl';
import StatCard from '../../components/ui/StatCard';
import { useAdminResource } from '../../hooks/useAdminResource';
import { useNow } from '../../hooks/useNow';
import { adminApi } from '../../lib/api';
import { formatMs, formatNumber, formatRelative } from '../../lib/format';

const RANGES = [7, 14, 30, 90].map((d) => ({ value: d, label: `${d}d` }));

const sum = (series, key) => series.reduce((total, d) => total + (d[key] ?? 0), 0);

function StatsGrid({ stats }) {
  const loading = !stats;
  const s = stats ?? {};
  const checks = s.checksLast24h;
  const successRate = checks?.total ? (checks.success / checks.total) * 100 : null;

  return (
    <div className="stagger-children grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard
        label="Registered users"
        icon={Users}
        loading={loading}
        value={loading ? '' : formatNumber(s.users.total)}
        hint={loading ? '' : `${s.users.admins} admin${s.users.admins === 1 ? '' : 's'} · ${s.users.withMonitors} with monitors`}
      />
      <StatCard
        label="New users"
        icon={UserPlus}
        loading={loading}
        value={loading ? '' : formatNumber(s.users.newLast7Days)}
        unit="last 7 days"
        hint={loading ? '' : `${formatNumber(s.users.newLast30Days)} in the last 30 days`}
      />
      <StatCard
        label="Monitors"
        icon={Server}
        tone={!loading && s.monitors.down > 0 ? 'danger' : 'default'}
        loading={loading}
        value={loading ? '' : formatNumber(s.monitors.total)}
        hint={loading ? '' : `${s.monitors.up} up · ${s.monitors.down} down · ${s.monitors.unknown} not checked yet`}
      />
      <StatCard
        label="Open incidents"
        icon={TriangleAlert}
        tone={!loading && s.incidents.open > 0 ? 'danger' : 'default'}
        loading={loading}
        value={loading ? '' : formatNumber(s.incidents.open)}
        hint={loading ? '' : `${formatNumber(s.incidents.resolved)} resolved in total`}
      />
      <StatCard
        label="Checks (24h)"
        icon={Activity}
        loading={loading}
        value={loading ? '' : formatNumber(checks.total)}
        hint={loading ? '' : `${formatNumber(checks.success)} passed · ${formatNumber(checks.failure)} failed`}
      />
      <StatCard
        label="Check success rate (24h)"
        icon={CheckCircle2}
        tone={successRate != null && successRate < 99 ? 'danger' : 'default'}
        loading={loading}
        value={loading ? '' : successRate == null ? '—' : successRate.toFixed(1)}
        unit={successRate == null ? undefined : '%'}
        hint={loading ? '' : successRate == null ? 'No checks in the last 24 hours' : 'Across all monitors'}
      />
      <StatCard
        label="Avg response time (24h)"
        icon={Activity}
        loading={loading}
        value={loading ? '' : checks.avgResponseTime == null ? '—' : String(checks.avgResponseTime)}
        unit={checks?.avgResponseTime == null ? undefined : 'ms'}
        hint={loading ? '' : checks.avgResponseTime == null ? 'No responses recorded' : 'Checks that got a response'}
      />
      <StatCard
        label="Resolved incidents"
        icon={CheckCircle2}
        loading={loading}
        value={loading ? '' : formatNumber(s.incidents.resolved)}
        hint={loading ? '' : `${formatNumber(s.incidents.total)} incidents recorded`}
      />
    </div>
  );
}

function ChartCard({ title, description, children, empty, emptyTitle, emptyDescription, loading }) {
  return (
    <Card>
      <CardHeader title={title} description={description} />
      <CardBody>
        {loading ? (
          <div className="h-[220px] skeleton rounded-md bg-hover/60" aria-busy="true" aria-label={`Loading ${title}`} />
        ) : empty ? (
          <ChartEmptyState height={220} title={emptyTitle} description={emptyDescription} />
        ) : (
          children
        )}
      </CardBody>
    </Card>
  );
}

function Analytics() {
  const [days, setDays] = useState(30);
  const analytics = useAdminResource(() => adminApi.analytics(days), days);
  const data = analytics.data;
  const series = data?.series ?? [];
  const loading = !data && analytics.status === 'loading';
  const beyondRetention = data && days > data.checkRetentionDays;

  return (
    <section aria-labelledby="admin-analytics" className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id="admin-analytics" className="text-sm font-medium text-fg">
            Trends
          </h2>
          <p className="text-xs text-muted">Daily totals by UTC day, across every account.</p>
        </div>
        <SegmentedControl label="Time range" options={RANGES} value={days} onChange={setDays} />
      </div>

      {analytics.status === 'error' ? (
        <Card>
          <ResourceError resource={analytics} title="Couldn’t load analytics" />
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
          <ChartCard
            title="User registrations"
            description={data ? `${sum(series, 'registrations')} sign-ups in the last ${days} days` : undefined}
            loading={loading}
            empty={data && sum(series, 'registrations') === 0}
            emptyTitle="No sign-ups in this period"
          >
            <RegistrationsChart series={series} />
          </ChartCard>
          <ChartCard
            title="Incidents opened and resolved"
            description={data ? `${sum(series, 'incidentsOpened')} opened · ${sum(series, 'incidentsResolved')} resolved` : undefined}
            loading={loading}
            empty={data && sum(series, 'incidentsOpened') + sum(series, 'incidentsResolved') === 0}
            emptyTitle="No incidents in this period"
          >
            <IncidentsChart series={series} />
          </ChartCard>
          <ChartCard
            title="Check results"
            description={
              beyondRetention
                ? `Check results are kept for ${data.checkRetentionDays} days; older days show no data.`
                : 'Successful and failed checks per day'
            }
            loading={loading}
            empty={data && sum(series, 'checksTotal') === 0}
            emptyTitle="No checks recorded in this period"
            emptyDescription="Checks appear once monitors exist and the monitoring engine is running."
          >
            <ChecksChart series={series} />
          </ChartCard>
          <ChartCard
            title="Average response time"
            description="Daily mean of checks that received a response"
            loading={loading}
            empty={data && series.every((d) => d.avgResponseTime == null)}
            emptyTitle="No response times recorded"
            emptyDescription="Response times are stored with each check result."
          >
            <ResponseTrendChart series={series} />
          </ChartCard>
        </div>
      )}
    </section>
  );
}

function RecentSignups({ users, now }) {
  return (
    <Card>
      <CardHeader title="Recent sign-ups" action={<Link to="/admin/users" className="text-xs font-medium text-accent hover:underline">View all</Link>} />
      <CardBody className="pt-1">
        {users.length === 0 ? (
          <p className="py-6 text-center text-xs text-muted">No users yet.</p>
        ) : (
          <ul className="divide-y divide-line">
            {users.map((u) => (
              <li key={u.id} className="flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-sm text-fg">{u.username}</p>
                  <p className="truncate text-xs text-muted">{u.email}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <RoleBadge role={u.role} />
                  <span className="w-16 text-right text-xs text-faint" title={new Date(u.createdAt).toLocaleString()}>
                    {formatRelative(Date.parse(u.createdAt), now)}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}

function RecentIncidents({ incidents, now }) {
  return (
    <Card>
      <CardHeader title="Recent incidents" action={<Link to="/admin/incidents" className="text-xs font-medium text-accent hover:underline">View all</Link>} />
      <CardBody className="pt-1">
        {incidents.length === 0 ? (
          <p className="py-6 text-center text-xs text-muted">No incidents recorded.</p>
        ) : (
          <ul className="divide-y divide-line">
            {incidents.map((i) => (
              <li key={i.id} className="flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-sm text-fg">{i.monitor?.name ?? 'Deleted monitor'}</p>
                  <p className="truncate text-xs text-muted">
                    {i.reason}
                    {i.owner ? ` · ${i.owner.email}` : ''}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <IncidentStatusBadge status={i.status} />
                  <span className="w-16 text-right text-xs text-faint">{formatRelative(Date.parse(i.startedAt), now)}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}

export default function AdminDashboard() {
  const [refreshKey, setRefreshKey] = useState(0);
  const stats = useAdminResource(adminApi.stats, refreshKey);
  const now = useNow(30_000);

  return (
    <>
      <PageHeader description="Platform-wide overview across all accounts. Every number comes from the database.">
        <Button size="sm" onClick={() => setRefreshKey((k) => k + 1)} disabled={stats.refreshing}>
          {stats.refreshing ? 'Refreshing…' : 'Refresh'}
        </Button>
      </PageHeader>

      {stats.status === 'error' ? (
        <Card>
          <ResourceError resource={stats} title="Couldn’t load admin statistics" />
        </Card>
      ) : (
        <div className="space-y-6">
          <StatsGrid stats={stats.data} />

          <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
            <Card className="lg:col-span-1">
              <CardHeader title="Monitor status" description="Latest check result of every monitor" />
              <CardBody>
                {!stats.data ? (
                  <div className="h-[180px] skeleton rounded-md bg-hover/60" aria-busy="true" />
                ) : stats.data.monitors.total === 0 ? (
                  <ChartEmptyState height={180} title="No monitors yet" />
                ) : (
                  <StatusDonut monitors={stats.data.monitors} />
                )}
              </CardBody>
            </Card>
            <div className="lg:col-span-2">
              <div className="grid h-full grid-cols-1 gap-3 md:grid-cols-2">
                {stats.data ? (
                  <>
                    <RecentSignups users={stats.data.recentSignups} now={now} />
                    <RecentIncidents incidents={stats.data.recentIncidents} now={now} />
                  </>
                ) : (
                  <>
                    <div className="h-64 skeleton rounded-lg border border-line bg-hover/40" />
                    <div className="h-64 skeleton rounded-lg border border-line bg-hover/40" />
                  </>
                )}
              </div>
            </div>
          </div>

          <Analytics />

          <p className="text-xs text-faint">
            Not shown: sign-in activity and an audit log of system events. The backend doesn’t record logins, so “active users”
            can’t be measured; role changes are written to the server log only.
          </p>
        </div>
      )}
    </>
  );
}
