import { cn } from '../../lib/cn';

const STATUS = {
  up: { label: 'Up', dot: 'bg-success', text: 'text-success', ring: 'bg-success/10 border-success/20' },
  down: { label: 'Down', dot: 'bg-danger', text: 'text-danger', ring: 'bg-danger/10 border-danger/25' },
  // Backend default before any check has reported.
  unknown: { label: 'Unknown', dot: 'bg-faint', text: 'text-muted', ring: 'bg-hover border-line' },
};

export const STATUS_LABELS = Object.fromEntries(Object.entries(STATUS).map(([k, v]) => [k, v.label]));

export default function StatusBadge({ status, className }) {
  const s = STATUS[status] ?? STATUS.unknown;
  return (
    <span
      className={cn(
        'inline-flex h-6 items-center gap-1.5 rounded-full border px-2 text-xs font-medium transition-colors duration-300 ease-out-soft',
        s.ring,
        s.text,
        className,
      )}
    >
      {/* Static dot: a looping ping on every Down row competes for attention in dense tables. */}
      <span key={status} className={cn('inline-flex h-1.5 w-1.5 animate-status-pop rounded-full', s.dot)} aria-hidden />

      {s.label}
    </span>
  );
}

/** Bare status dot for dense layouts. */
export function StatusDot({ status, className }) {
  const s = STATUS[status] ?? STATUS.unknown;
  return <span className={cn('inline-block h-2 w-2 shrink-0 rounded-full transition-colors duration-300', s.dot, className)} aria-label={s.label} />;
}
