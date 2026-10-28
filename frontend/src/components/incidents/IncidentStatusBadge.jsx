import { cn } from '../../lib/cn';

/** Open / Resolved pill, matching the backend's incident `status`. */
export default function IncidentStatusBadge({ status, className }) {
  const open = status === 'open';
  return (
    <span
      className={cn(
        'inline-flex h-5 items-center gap-1.5 rounded border px-1.5 text-2xs font-medium uppercase tracking-wide',
        open ? 'border-danger/25 bg-danger/10 text-danger' : 'border-success/25 bg-success/10 text-success',
        className,
      )}
    >
      {open ? 'Open' : 'Resolved'}
    </span>
  );
}
