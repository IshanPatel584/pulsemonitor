import { cn } from '../../lib/cn';

/** Visible marker for illustrative, non-live example data. */
export default function DemoBadge({ className }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded border border-warning/30 bg-warning/10 px-1.5 py-px text-2xs font-semibold uppercase tracking-wide text-warning',
        className,
      )}
      title="Illustrative example, not live monitoring data"
    >
      Demo data
    </span>
  );
}
