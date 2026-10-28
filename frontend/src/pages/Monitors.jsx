import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ArrowDownUp, Plus, Search, SearchX, Server, X } from 'lucide-react';
import PageHeader from '../components/layout/PageHeader';
import MonitorTable from '../components/monitors/MonitorTable';
import Button from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Dropdown, DropdownItem, DropdownLabel } from '../components/ui/Dropdown';
import EmptyState from '../components/ui/EmptyState';
import ErrorState from '../components/ui/ErrorState';
import Pagination from '../components/ui/Pagination';
import SegmentedControl from '../components/ui/SegmentedControl';
import { useApp } from '../context/AppContext';
import { countByStatus, filterMonitors, sortMonitors } from '../lib/monitors';

const PAGE_SIZE = 8;

const SORT_OPTIONS = [
  { key: 'name', direction: 'asc', label: 'Name (A–Z)' },
  { key: 'status', direction: 'asc', label: 'Status (down first)' },
  { key: 'createdAt', direction: 'desc', label: 'Newest first' },
  { key: 'createdAt', direction: 'asc', label: 'Oldest first' },
  { key: 'interval', direction: 'asc', label: 'Shortest interval' },
];

export default function Monitors() {
  const { monitors, monitorsStatus, monitorsError, refreshMonitors, openAddMonitor } = useApp();
  const loading = monitorsStatus === 'loading' || monitorsStatus === 'idle';
  const [params, setParams] = useSearchParams();
  const query = params.get('q') ?? '';
  const [status, setStatus] = useState('all');
  const [sort, setSort] = useState({ key: 'name', direction: 'asc' });
  const [page, setPage] = useState(1);

  const setQuery = (value) => {
    const next = new URLSearchParams(params);
    if (value) next.set('q', value);
    else next.delete('q');
    setParams(next, { replace: true });
  };

  useEffect(() => setPage(1), [query, status, sort]);

  const counts = countByStatus(monitors);
  const filtered = useMemo(() => sortMonitors(filterMonitors(monitors, { query, status }), sort), [monitors, query, status, sort]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const visible = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const statusOptions = [
    { value: 'all', label: 'All', count: monitors.length },
    { value: 'up', label: 'Up', count: counts.up },
    { value: 'down', label: 'Down', count: counts.down },
    { value: 'unknown', label: 'Unknown', count: counts.unknown },
  ];

  const sortLabel = SORT_OPTIONS.find((o) => o.key === sort.key && o.direction === sort.direction)?.label ?? 'Custom';
  const hasFilters = query || status !== 'all';

  return (
    <>
      <PageHeader
        description={
          loading ? 'Loading monitors…' : `${monitors.length} monitor${monitors.length === 1 ? '' : 's'} in your workspace.`
        }
      >
        <Button variant="primary" icon={Plus} onClick={openAddMonitor}>
          Add Monitor
        </Button>
      </PageHeader>

      <Card>
        <div className="flex flex-col gap-3 p-3 sm:p-4 lg:flex-row lg:items-center">
          <div className="relative lg:w-72">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" aria-hidden />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name or URL"
              className="input pl-8 pr-8 [&::-webkit-search-cancel-button]:hidden"
              aria-label="Search monitors"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                className="focus-ring absolute right-1.5 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded text-faint transition-colors hover:bg-hover hover:text-fg"
                aria-label="Clear search"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <div className="-mx-1 overflow-x-auto px-1">
            <SegmentedControl label="Filter by status" options={statusOptions} value={status} onChange={setStatus} />
          </div>

          <div className="lg:ml-auto">
            <Dropdown
              width={220}
              trigger={({ open, ...props }) => (
                <Button {...props} size="sm" icon={ArrowDownUp} className="h-9 whitespace-nowrap">
                  <span className="text-muted">Sort:</span> {sortLabel}
                </Button>
              )}
            >
              <DropdownLabel>Sort monitors</DropdownLabel>
              {SORT_OPTIONS.map((opt) => (
                <DropdownItem
                  key={opt.label}
                  onSelect={() => setSort({ key: opt.key, direction: opt.direction })}
                  hint={opt.label === sortLabel ? '✓' : undefined}
                >
                  {opt.label}
                </DropdownItem>
              ))}
            </Dropdown>
          </div>
        </div>

        <div className="border-t border-line">
          {monitorsStatus === 'error' ? (
            <ErrorState
              title="Couldn’t load monitors"
              message={monitorsError}
              onRetry={() => refreshMonitors().catch(() => {})}
            />
          ) : (
            <MonitorTable
              monitors={visible}
              sort={sort}
              onSortChange={setSort}
              loading={loading}
              empty={
                monitors.length === 0 ? (
                  <EmptyState
                    icon={Server}
                    title="No monitors yet"
                    description="Add your first endpoint to start tracking its status."
                    action={
                      <Button size="sm" variant="primary" icon={Plus} onClick={openAddMonitor}>
                        Add Monitor
                      </Button>
                    }
                  />
                ) : (
                  <EmptyState
                    icon={SearchX}
                    title="No monitors match your filters"
                    description={query ? `Nothing matches “${query}”. Try a different name or URL.` : 'Try a different status filter.'}
                    action={
                      hasFilters && (
                        <Button
                          size="sm"
                          onClick={() => {
                            setQuery('');
                            setStatus('all');
                          }}
                        >
                          Clear filters
                        </Button>
                      )
                    }
                  />
                )
              }
            />
          )}
        </div>

        {!loading && monitorsStatus !== 'error' && filtered.length > 0 && <Pagination page={currentPage} pageSize={PAGE_SIZE} total={filtered.length} onPageChange={setPage} />}
      </Card>
    </>
  );
}
