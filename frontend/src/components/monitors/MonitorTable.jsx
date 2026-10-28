import { useState } from 'react';
import { ArrowDown, ArrowUp, ChevronsUpDown } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useNow } from '../../hooks/useNow';
import { displayUrl, formatDateTime, formatInterval, formatMs, formatPercent, formatRelative, responseTone, uptimeTone } from '../../lib/format';
import { cn } from '../../lib/cn';
import { ConfirmDialog } from '../ui/Modal';
import StatusBadge from '../ui/StatusBadge';
import MonitorActionsMenu from './MonitorActionsMenu';

const COLUMNS = [
  { key: 'name', label: 'Monitor' },
  { key: 'url', label: 'Endpoint', className: 'hidden md:table-cell' },
  { key: 'status', label: 'Status' },
  { key: 'responseTime', label: 'Response', align: 'right' },
  { key: 'uptime', label: 'Uptime (30d)', align: 'right', className: 'hidden sm:table-cell' },
  { key: 'lastChecked', label: 'Last checked', className: 'hidden lg:table-cell' },
];

function SortHeader({ column, sort, onSortChange }) {
  const active = sort?.key === column.key;
  const Icon = !active ? ChevronsUpDown : sort.direction === 'asc' ? ArrowUp : ArrowDown;

  const content = (
    <>
      {column.label}
      {onSortChange && <Icon className={cn('h-3 w-3', active ? 'text-fg' : 'text-faint opacity-0 group-hover:opacity-100')} aria-hidden />}
    </>
  );

  return (
    <th
      scope="col"
      aria-sort={active ? (sort.direction === 'asc' ? 'ascending' : 'descending') : undefined}
      className={cn('h-9 whitespace-nowrap px-3 text-xs font-medium text-muted first:pl-4 sm:first:pl-5', column.className, column.align === 'right' && 'text-right')}
    >
      {onSortChange ? (
        <button
          type="button"
          onClick={() =>
            onSortChange({
              key: column.key,
              direction: active && sort.direction === 'asc' ? 'desc' : 'asc',
            })
          }
          className={cn('focus-ring group inline-flex items-center gap-1 rounded hover:text-fg', active && 'text-fg', column.align === 'right' && 'flex-row-reverse')}
        >
          {content}
        </button>
      ) : (
        content
      )}
    </th>
  );
}

function MethodTag({ method }) {
  return <span className="rounded border border-line px-1 font-mono text-2xs text-muted">{method}</span>;
}

function SkeletonRows({ count }) {
  return Array.from({ length: count }, (_, i) => (
    <tr key={i} className="border-b border-line last:border-0">
      <td className="py-3 pl-4 pr-3 sm:pl-5">
        <div className="h-3.5 w-32 skeleton rounded bg-hover" />
        <div className="mt-1.5 h-3 w-16 skeleton rounded bg-hover" />
      </td>
      <td className="hidden px-3 md:table-cell">
        <div className="h-3 w-48 skeleton rounded bg-hover" />
      </td>
      <td className="px-3">
        <div className="h-5 w-14 skeleton rounded-full bg-hover" />
      </td>
      <td className="px-3">
        <div className="ml-auto h-3 w-10 skeleton rounded bg-hover" />
      </td>
      <td className="hidden px-3 sm:table-cell">
        <div className="ml-auto h-3 w-12 skeleton rounded bg-hover" />
      </td>
      <td className="hidden px-3 lg:table-cell">
        <div className="h-3 w-14 skeleton rounded bg-hover" />
      </td>
      <td />
    </tr>
  ));
}

const NOT_CHECKED = 'Not checked yet';
const NO_RESPONSE = 'No response received on the last check';
const NO_UPTIME = 'Uptime history isn’t available yet';

/**
 * Monitor list table. Sorting is controlled by the parent: pass `sort` and
 * `onSortChange` to enable clickable headers. `loading` renders skeleton rows.
 */
export default function MonitorTable({ monitors, sort, onSortChange, empty, loading = false, skeletonRows = 5 }) {
  const { deleteMonitor, notify } = useApp();
  const [pendingDelete, setPendingDelete] = useState(null);
  const now = useNow(10_000);

  return (
    <>
      <div className="overflow-x-auto" aria-busy={loading}>
        <table className="w-full min-w-[560px] border-collapse text-left">
          <thead className="border-b border-line">
            <tr>
              {COLUMNS.map((col) => (
                <SortHeader key={col.key} column={col} sort={sort} onSortChange={onSortChange} />
              ))}
              <th scope="col" className="w-12 pr-3 sm:pr-4">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {loading && <SkeletonRows count={skeletonRows} />}
            {!loading && monitors.map((m) => (
              <tr key={m.id} className="animate-fade-in border-b border-line transition-colors duration-150 last:border-0 hover:bg-hover/50">
                <td className="max-w-[240px] py-2.5 pl-4 pr-3 sm:pl-5">
                  <div className="truncate font-medium text-fg">{m.name}</div>
                  <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted">
                    <span className="truncate font-mono md:hidden">{displayUrl(m.url)}</span>
                    <span className="hidden md:inline">every {formatInterval(m.interval)}</span>
                  </div>
                </td>
                <td className="hidden max-w-[300px] px-3 md:table-cell">
                  <div className="flex items-center gap-2">
                    <MethodTag method={m.method} />
                    <span className="truncate font-mono text-xs text-muted" title={m.url}>
                      {displayUrl(m.url)}
                    </span>
                  </div>
                </td>
                <td className="px-3">
                  <StatusBadge status={m.status} />
                </td>
                <td
                  className={cn('whitespace-nowrap px-3 text-right font-mono text-xs tabular-nums', responseTone(m.responseTime))}
                  title={m.responseTime == null ? (m.lastError ?? (m.lastChecked ? NO_RESPONSE : NOT_CHECKED)) : m.lastError ?? undefined}
                >
                  {m.responseTime != null ? (
                    formatMs(m.responseTime)
                  ) : m.status === 'down' && m.lastChecked ? (
                    <span className="text-danger">Failed</span>
                  ) : (
                    '—'
                  )}
                </td>
                <td
                  className={cn('hidden whitespace-nowrap px-3 text-right font-mono text-xs tabular-nums sm:table-cell', uptimeTone(m.uptime))}
                  title={m.uptime == null ? NO_UPTIME : undefined}
                >
                  {formatPercent(m.uptime)}
                </td>
                <td className="hidden whitespace-nowrap px-3 text-xs text-muted lg:table-cell" title={m.lastChecked ? formatDateTime(m.lastChecked) : NOT_CHECKED}>
                  {m.lastChecked ? (
                    <time dateTime={new Date(m.lastChecked).toISOString()}>{formatRelative(m.lastChecked, now)}</time>
                  ) : (
                    <span className="text-faint">—</span>
                  )}
                </td>
                <td className="pr-3 text-right sm:pr-4">
                  <MonitorActionsMenu monitor={m} onRequestDelete={setPendingDelete} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!loading && monitors.length === 0 && empty}
      </div>

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        onClose={() => setPendingDelete(null)}
        title="Delete monitor?"
        description={pendingDelete && `“${pendingDelete.name}” will be permanently deleted. This can’t be undone.`}
        confirmLabel="Delete monitor"
        busyLabel="Deleting…"
        onConfirm={async () => {
          await deleteMonitor(pendingDelete.id);
          notify(`Deleted “${pendingDelete.name}”.`, 'info');
        }}
      />
    </>
  );
}
