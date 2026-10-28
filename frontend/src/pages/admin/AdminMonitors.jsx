import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Server, X } from 'lucide-react';
import {
  AdminPagination,
  DetailList,
  FilterSelect,
  ResourceError,
  SearchInput,
  TableSkeleton,
  tdClass,
  thClass,
  useQueryState,
} from '../../components/admin/AdminUI';
import IncidentStatusBadge from '../../components/incidents/IncidentStatusBadge';
import PageHeader from '../../components/layout/PageHeader';
import Button from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import EmptyState from '../../components/ui/EmptyState';
import { Drawer } from '../../components/ui/Modal';
import StatusBadge from '../../components/ui/StatusBadge';
import { useAdminResource } from '../../hooks/useAdminResource';
import { useNow } from '../../hooks/useNow';
import { adminApi } from '../../lib/api';
import { displayUrl, formatDateTime, formatInterval, formatMs, formatRelative, responseTone } from '../../lib/format';
import { cn } from '../../lib/cn';

const PAGE_SIZE = 20;
const STATUS_FILTERS = [
  { value: '', label: 'All statuses' },
  { value: 'up', label: 'Up' },
  { value: 'down', label: 'Down' },
  { value: 'unknown', label: 'Not checked yet' },
];
const SORTS = [
  { value: '-createdAt', label: 'Newest first' },
  { value: 'createdAt', label: 'Oldest first' },
  { value: 'name', label: 'Name A–Z' },
  { value: 'status', label: 'Status' },
  { value: '-lastCheckedAt', label: 'Recently checked' },
  { value: '-lastResponseTime', label: 'Slowest response' },
];

const toPage = (value) => (/^\d+$/.test(value) && Number(value) >= 1 ? Number(value) : 1);
const isObjectId = (value) => /^[a-f0-9]{24}$/i.test(value);

function MonitorDetail({ monitorId }) {
  const detail = useAdminResource(() => adminApi.monitor(monitorId), monitorId);
  const now = useNow(30_000);

  if (detail.status !== 'ready') {
    return detail.status === 'error' ? (
      <ResourceError resource={detail} title="Couldn’t load this monitor" />
    ) : (
      <div className="space-y-3 p-5" aria-busy="true">
        <div className="h-4 w-40 skeleton rounded bg-hover" />
        <div className="h-24 skeleton rounded bg-hover" />
      </div>
    );
  }

  const { monitor: m, checksLast24h: day, recentChecks, recentIncidents } = detail.data;

  return (
    <div className="space-y-6 p-5">
      <DetailList
        items={[
          ['Status', <StatusBadge status={m.status} />],
          ['URL', <span className="font-mono text-xs">{m.url}</span>],
          ['Method', m.method],
          ['Interval', formatInterval(m.interval)],
          ['Expected status', m.expectedStatusCode],
          ['Owner', m.owner ? `${m.owner.username} (${m.owner.email})` : 'Deleted account'],
          ['Last checked', m.lastCheckedAt ? `${formatDateTime(Date.parse(m.lastCheckedAt))} (${formatRelative(Date.parse(m.lastCheckedAt), now)})` : 'Never'],
          ['Last status code', m.lastStatusCode ?? '—'],
          ['Last response time', formatMs(m.lastResponseTime)],
          ['Last error', m.lastError ?? '—'],
          ['Created', m.createdAt ? formatDateTime(Date.parse(m.createdAt)) : '—'],
        ]}
      />

      <section>
        <h3 className="mb-2 text-sm font-medium text-fg">Last 24 hours</h3>
        <div className="grid grid-cols-3 gap-2 text-center">
          {[
            ['Checks', day.total],
            ['Failed', day.failure],
            ['Avg response', formatMs(day.avgResponseTime)],
          ].map(([label, value]) => (
            <div key={label} className="rounded-md border border-line px-2 py-2.5">
              <p className="text-base font-semibold tabular-nums text-fg">{value}</p>
              <p className="text-2xs text-muted">{label}</p>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h3 className="mb-2 text-sm font-medium text-fg">Latest checks</h3>
        {recentChecks.length === 0 ? (
          <p className="text-xs text-muted">No checks recorded yet.</p>
        ) : (
          <ul className="max-h-72 divide-y divide-line overflow-y-auto rounded-lg border border-line">
            {recentChecks.map((c) => (
              <li key={c.id} className="flex items-center gap-3 px-3 py-2 text-xs">
                <span className={cn('h-2 w-2 shrink-0 rounded-full', c.success ? 'bg-success' : 'bg-danger')} aria-label={c.success ? 'Passed' : 'Failed'} />
                <span className="w-28 shrink-0 text-muted">{formatDateTime(Date.parse(c.checkedAt))}</span>
                <span className="w-10 shrink-0 font-mono tabular-nums text-fg">{c.statusCode ?? '—'}</span>
                <span className={cn('w-16 shrink-0 text-right font-mono tabular-nums', responseTone(c.responseTime))}>{formatMs(c.responseTime)}</span>
                <span className="min-w-0 truncate text-muted" title={c.error ?? undefined}>
                  {c.error ?? ''}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h3 className="mb-2 text-sm font-medium text-fg">Recent incidents</h3>
        {recentIncidents.length === 0 ? (
          <p className="text-xs text-muted">No incidents.</p>
        ) : (
          <ul className="divide-y divide-line rounded-lg border border-line">
            {recentIncidents.map((i) => (
              <li key={i.id} className="flex items-center justify-between gap-3 px-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-sm text-fg">{i.reason}</p>
                  <p className="text-xs text-muted">{formatDateTime(Date.parse(i.startedAt))}</p>
                </div>
                <IncidentStatusBadge status={i.status} />
              </li>
            ))}
          </ul>
        )}
        <Link to={`/admin/incidents?monitorId=${m.id}`} className="mt-2 inline-block text-xs font-medium text-accent hover:underline">
          View all incidents for this monitor
        </Link>
      </section>
    </div>
  );
}

export default function AdminMonitors() {
  const [query, setQuery] = useQueryState({ page: '1', search: '', status: '', sort: '-createdAt', userId: '' });
  const page = toPage(query.page);
  const userId = isObjectId(query.userId) ? query.userId : '';
  const [selected, setSelected] = useState(null);
  const now = useNow(30_000);

  const params = { page, limit: PAGE_SIZE, search: query.search, status: query.status, sort: query.sort, userId };
  const monitors = useAdminResource(() => adminApi.monitors(params), JSON.stringify(params));
  const data = monitors.data;
  const filtered = Boolean(query.search || query.status || userId);
  const ownerFilter = userId && data?.monitors[0]?.owner;

  return (
    <>
      <PageHeader description="Monitors from every account, read-only. URL parameters that look like credentials are hidden." />

      <Card className="overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-line px-4 py-3 sm:flex-row sm:flex-wrap sm:items-center sm:px-5">
          <SearchInput value={query.search} onChange={(search) => setQuery({ search })} placeholder="Search name, URL or owner" />
          <FilterSelect label="Status" value={query.status} onChange={(status) => setQuery({ status })} options={STATUS_FILTERS} />
          {userId && (
            <span className="inline-flex h-7 items-center gap-1.5 rounded-full border border-line bg-hover pl-2.5 pr-1 text-xs text-fg">
              Owner: {ownerFilter ? ownerFilter.email : `…${userId.slice(-6)}`}
              <button type="button" onClick={() => setQuery({ userId: '' })} className="focus-ring rounded-full p-0.5 text-muted hover:text-fg" aria-label="Clear owner filter">
                <X className="h-3.5 w-3.5" />
              </button>
            </span>
          )}
          <FilterSelect label="Sort" value={query.sort} onChange={(sort) => setQuery({ sort })} options={SORTS} className="sm:ml-auto" />
        </div>

        {monitors.status === 'error' ? (
          <ResourceError resource={monitors} title="Couldn’t load monitors" />
        ) : !data ? (
          <TableSkeleton columns={6} />
        ) : data.monitors.length === 0 ? (
          <EmptyState
            icon={Server}
            title={page > 1 ? 'This page is empty' : filtered ? 'No monitors match these filters' : 'No monitors yet'}
            description={filtered ? 'Try a different search or status.' : 'Monitors appear here when any user creates one.'}
            action={
              page > 1 ? (
                <Button size="sm" onClick={() => setQuery({ page: 1 })}>Go to page 1</Button>
              ) : (
                filtered && <Button size="sm" onClick={() => setQuery({ search: '', status: '', userId: '' })}>Clear filters</Button>
              )
            }
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[880px] text-sm">
                <thead className="border-b border-line bg-hover/30">
                  <tr>
                    <th className={thClass}>Monitor</th>
                    <th className={thClass}>Owner</th>
                    <th className={thClass}>Status</th>
                    <th className={thClass}>Last check</th>
                    <th className={`${thClass} text-right`}>Response</th>
                    <th className={thClass}>Result</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {data.monitors.map((m) => (
                    <tr key={m.id} onClick={() => setSelected(m)} className="cursor-pointer transition-colors hover:bg-hover/50">
                      <td className={tdClass}>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelected(m);
                          }}
                          className="focus-ring block max-w-[300px] rounded text-left"
                        >
                          <span className="block truncate font-medium text-fg">{m.name}</span>
                          <span className="block truncate font-mono text-2xs text-muted">
                            {m.method} {displayUrl(m.url)}
                          </span>
                        </button>
                      </td>
                      <td className={tdClass}>
                        {m.owner ? (
                          <span className="block max-w-[200px] truncate text-muted" title={m.owner.email}>
                            {m.owner.email}
                          </span>
                        ) : (
                          <span className="text-faint">Deleted account</span>
                        )}
                      </td>
                      <td className={tdClass}>
                        <StatusBadge status={m.status} />
                      </td>
                      <td className={`${tdClass} whitespace-nowrap text-muted`} title={m.lastCheckedAt ? formatDateTime(Date.parse(m.lastCheckedAt)) : undefined}>
                        {m.lastCheckedAt ? formatRelative(Date.parse(m.lastCheckedAt), now) : 'Never'}
                      </td>
                      <td className={cn(tdClass, 'text-right font-mono tabular-nums', responseTone(m.lastResponseTime))}>{formatMs(m.lastResponseTime)}</td>
                      <td className={tdClass}>
                        <span className="block max-w-[220px] truncate text-xs text-muted" title={m.lastError ?? undefined}>
                          {m.lastError ?? (m.lastStatusCode ? `HTTP ${m.lastStatusCode}` : '—')}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <AdminPagination {...data} busy={monitors.refreshing} onPageChange={(p) => setQuery({ page: p })} />
          </>
        )}
      </Card>

      <Drawer open={Boolean(selected)} onClose={() => setSelected(null)} title={selected?.name ?? 'Monitor'} description={selected?.owner?.email}>
        {selected && <MonitorDetail monitorId={selected.id} />}
      </Drawer>
    </>
  );
}
