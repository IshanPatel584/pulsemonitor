import { TriangleAlert, X } from 'lucide-react';
import {
  AdminPagination,
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
import { useAdminResource } from '../../hooks/useAdminResource';
import { useNow } from '../../hooks/useNow';
import { adminApi } from '../../lib/api';
import { displayUrl, formatDateTime, formatDuration } from '../../lib/format';

const PAGE_SIZE = 20;
const STATUS_FILTERS = [
  { value: '', label: 'All' },
  { value: 'open', label: 'Open' },
  { value: 'resolved', label: 'Resolved' },
];
const SORTS = [
  { value: '-startedAt', label: 'Newest first' },
  { value: 'startedAt', label: 'Oldest first' },
  { value: '-resolvedAt', label: 'Recently resolved' },
  { value: 'status', label: 'Open first' },
];

const toPage = (value) => (/^\d+$/.test(value) && Number(value) >= 1 ? Number(value) : 1);
const isObjectId = (value) => /^[a-f0-9]{24}$/i.test(value);

export default function AdminIncidents() {
  const [query, setQuery] = useQueryState({ page: '1', search: '', status: '', sort: '-startedAt', monitorId: '' });
  const page = toPage(query.page);
  const monitorId = isObjectId(query.monitorId) ? query.monitorId : '';
  const now = useNow(30_000);

  const params = { page, limit: PAGE_SIZE, search: query.search, status: query.status, sort: query.sort, monitorId };
  const incidents = useAdminResource(() => adminApi.incidents(params), JSON.stringify(params));
  const data = incidents.data;
  const filtered = Boolean(query.search || query.status || monitorId);
  const monitorName = monitorId && data?.incidents[0]?.monitor?.name;

  return (
    <>
      <PageHeader description="Incidents from every account. An incident opens when a check fails and resolves when the monitor recovers." />

      <Card className="overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-line px-4 py-3 sm:flex-row sm:flex-wrap sm:items-center sm:px-5">
          <SearchInput value={query.search} onChange={(search) => setQuery({ search })} placeholder="Search reason or monitor" />
          <FilterSelect label="Status" value={query.status} onChange={(status) => setQuery({ status })} options={STATUS_FILTERS} />
          {monitorId && (
            <span className="inline-flex h-7 items-center gap-1.5 rounded-full border border-line bg-hover pl-2.5 pr-1 text-xs text-fg">
              Monitor: {monitorName || `…${monitorId.slice(-6)}`}
              <button type="button" onClick={() => setQuery({ monitorId: '' })} className="focus-ring rounded-full p-0.5 text-muted hover:text-fg" aria-label="Clear monitor filter">
                <X className="h-3.5 w-3.5" />
              </button>
            </span>
          )}
          <FilterSelect label="Sort" value={query.sort} onChange={(sort) => setQuery({ sort })} options={SORTS} className="sm:ml-auto" />
        </div>

        {incidents.status === 'error' ? (
          <ResourceError resource={incidents} title="Couldn’t load incidents" />
        ) : !data ? (
          <TableSkeleton columns={6} />
        ) : data.incidents.length === 0 ? (
          <EmptyState
            icon={TriangleAlert}
            title={page > 1 ? 'This page is empty' : filtered ? 'No incidents match these filters' : 'No incidents recorded'}
            description={filtered ? 'Try a different search or status.' : 'Incidents appear when a monitor’s check fails.'}
            action={
              page > 1 ? (
                <Button size="sm" onClick={() => setQuery({ page: 1 })}>Go to page 1</Button>
              ) : (
                filtered && <Button size="sm" onClick={() => setQuery({ search: '', status: '', monitorId: '' })}>Clear filters</Button>
              )
            }
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[920px] text-sm">
                <thead className="border-b border-line bg-hover/30">
                  <tr>
                    <th className={thClass}>Status</th>
                    <th className={thClass}>Monitor</th>
                    <th className={thClass}>Owner</th>
                    <th className={thClass}>Reason</th>
                    <th className={thClass}>Started</th>
                    <th className={thClass}>Resolved</th>
                    <th className={`${thClass} text-right`}>Duration</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {data.incidents.map((i) => {
                    const started = Date.parse(i.startedAt);
                    const resolved = i.resolvedAt ? Date.parse(i.resolvedAt) : null;
                    return (
                      <tr key={i.id} className="transition-colors hover:bg-hover/50">
                        <td className={tdClass}>
                          <IncidentStatusBadge status={i.status} />
                        </td>
                        <td className={tdClass}>
                          {i.monitor ? (
                            <span className="block max-w-[220px]">
                              <span className="block truncate font-medium text-fg">{i.monitor.name}</span>
                              <span className="block truncate font-mono text-2xs text-muted">{displayUrl(i.monitor.url)}</span>
                            </span>
                          ) : (
                            <span className="text-faint">Deleted monitor</span>
                          )}
                        </td>
                        <td className={tdClass}>
                          <span className="block max-w-[180px] truncate text-muted" title={i.owner?.email}>
                            {i.owner?.email ?? 'Deleted account'}
                          </span>
                        </td>
                        <td className={tdClass}>
                          <span className="block max-w-[240px] truncate text-muted" title={i.reason}>
                            {i.reason}
                          </span>
                        </td>
                        <td className={`${tdClass} whitespace-nowrap text-muted`}>{formatDateTime(started)}</td>
                        <td className={`${tdClass} whitespace-nowrap text-muted`}>{resolved ? formatDateTime(resolved) : '—'}</td>
                        <td className={`${tdClass} whitespace-nowrap text-right tabular-nums text-muted`}>
                          {formatDuration((resolved ?? now) - started)}
                          {!resolved && <span className="ml-1 text-2xs text-danger">ongoing</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <AdminPagination {...data} busy={incidents.refreshing} onPageChange={(p) => setQuery({ page: p })} />
          </>
        )}
      </Card>
    </>
  );
}
