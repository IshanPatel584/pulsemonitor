import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Loader2, Search, ShieldAlert } from 'lucide-react';
import { DASHBOARD_HOME } from '../../config/navigation';
import { cn } from '../../lib/cn';
import ErrorState from '../ui/ErrorState';

/**
 * List state (page, search, filters, sort) kept in the URL, so a refresh or a
 * shared link shows the same view. Changing anything but `page` resets to page 1.
 */
export function useQueryState(defaults) {
  const [params, setParams] = useSearchParams();
  const values = Object.fromEntries(Object.entries(defaults).map(([key, fallback]) => [key, params.get(key) ?? fallback]));

  const update = (patch) => {
    setParams(
      (current) => {
        const next = new URLSearchParams(current);
        const resetPage = Object.keys(patch).some((key) => key !== 'page');
        for (const [key, value] of Object.entries({ ...(resetPage ? { page: '' } : {}), ...patch })) {
          if (value === '' || value == null || String(value) === String(defaults[key])) next.delete(key);
          else next.set(key, String(value));
        }
        return next;
      },
      { replace: true },
    );
  };

  return [values, update];
}

/** Search box that reports its value after a short pause in typing. */
export function SearchInput({ value, onChange, placeholder, label }) {
  const [text, setText] = useState(value);
  useEffect(() => setText(value), [value]);
  useEffect(() => {
    if (text === value) return undefined;
    const id = setTimeout(() => onChange(text.trim()), 300);
    return () => clearTimeout(id);
  }, [text, value, onChange]);

  return (
    <div className="relative w-full sm:w-72">
      <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" aria-hidden />
      <input
        type="search"
        value={text}
        maxLength={100}
        onChange={(e) => setText(e.target.value)}
        placeholder={placeholder}
        aria-label={label ?? placeholder}
        className="input pl-8"
      />
    </div>
  );
}

export function FilterSelect({ label, value, onChange, options, className }) {
  return (
    <label className={cn('flex items-center gap-2 text-xs text-muted', className)}>
      <span className="shrink-0">{label}</span>
      <select className="input h-9 w-auto pr-8" value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </label>
  );
}

/** Prev/next pager that scales to any page count (the API caps `limit` at 100). */
export function AdminPagination({ page, limit, total, totalPages, onPageChange, busy }) {
  const start = total === 0 ? 0 : (page - 1) * limit + 1;
  const end = Math.min(total, page * limit);
  const navButton =
    'focus-ring flex h-7 w-7 items-center justify-center rounded-md border border-line text-muted transition-colors hover:bg-hover hover:text-fg disabled:pointer-events-none disabled:opacity-40';

  return (
    <div className="flex items-center justify-between gap-4 border-t border-line px-4 py-3 text-xs text-muted sm:px-5">
      <span className="flex items-center gap-2 tabular-nums">
        {start}–{end} of {total}
        {busy && <Loader2 className="h-3.5 w-3.5 animate-spin text-faint" aria-label="Loading" />}
      </span>
      <div className="flex items-center gap-2">
        <span className="tabular-nums">
          Page {Math.min(page, totalPages)} of {totalPages}
        </span>
        <button type="button" className={navButton} onClick={() => onPageChange(page - 1)} disabled={page <= 1} aria-label="Previous page">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <button type="button" className={navButton} onClick={() => onPageChange(page + 1)} disabled={page >= totalPages} aria-label="Next page">
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

export function RoleBadge({ role }) {
  const admin = role === 'admin';
  return (
    <span
      className={cn(
        'inline-flex h-5 items-center rounded border px-1.5 text-2xs font-medium uppercase tracking-wide',
        admin ? 'border-accent/25 bg-accent/10 text-accent' : 'border-line bg-hover text-muted',
      )}
    >
      {admin ? 'Admin' : 'User'}
    </span>
  );
}

/** Shown when an admin request answers 403 (the role was removed mid-session). */
export function ForbiddenNotice() {
  return (
    <div role="alert" className="flex flex-col items-center justify-center px-6 py-12 text-center">
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg border border-danger/30 bg-danger/10 text-danger">
        <ShieldAlert className="h-5 w-5" aria-hidden />
      </div>
      <p className="text-sm font-medium text-fg">Admin access required</p>
      <p className="mt-1 max-w-sm text-xs text-muted">Your account no longer has the admin role, so this data can’t be shown.</p>
      <Link to={DASHBOARD_HOME} className="mt-4 text-xs font-medium text-accent hover:underline">
        Go to your dashboard
      </Link>
    </div>
  );
}

/** Error or 403 for a resource from useAdminResource; renders nothing otherwise. */
export function ResourceError({ resource, title = 'Couldn’t load this data' }) {
  if (resource.status !== 'error') return null;
  if (resource.forbidden) return <ForbiddenNotice />;
  return <ErrorState title={title} message={resource.error} onRetry={resource.reload} retrying={resource.refreshing} />;
}

export function TableSkeleton({ rows = 6, columns = 5 }) {
  return (
    <div aria-busy="true" aria-label="Loading" className="divide-y divide-line">
      {Array.from({ length: rows }, (_, r) => (
        <div key={r} className="flex gap-4 px-4 py-3.5 sm:px-5">
          {Array.from({ length: columns }, (_, c) => (
            <div key={c} className="h-3.5 flex-1 skeleton rounded bg-hover" />
          ))}
        </div>
      ))}
    </div>
  );
}

export const thClass = 'whitespace-nowrap px-4 py-2.5 text-left text-2xs font-medium uppercase tracking-wider text-faint first:pl-4 sm:first:pl-5';
export const tdClass = 'px-4 py-3 align-middle first:pl-4 sm:first:pl-5';

/** Short form of a Mongo id for dense tables; the full id is in the title. */
export function ShortId({ id }) {
  return (
    <span className="font-mono text-2xs text-faint" title={id}>
      …{String(id).slice(-6)}
    </span>
  );
}

/** Label/value rows for drawers and settings. */
export function DetailList({ items }) {
  return (
    <dl className="divide-y divide-line">
      {items.map(([label, value]) => (
        <div key={label} className="flex items-start justify-between gap-4 py-2.5 text-sm">
          <dt className="shrink-0 text-muted">{label}</dt>
          <dd className="min-w-0 break-words text-right text-fg">{value}</dd>
        </div>
      ))}
    </dl>
  );
}
