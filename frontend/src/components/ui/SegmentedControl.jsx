import { cn } from '../../lib/cn';

/** Compact pill group for filters and time ranges. */
export default function SegmentedControl({ options, value, onChange, label, className, disabled = false, title }) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      aria-disabled={disabled || undefined}
      title={title}
      className={cn('inline-flex rounded-md border border-line bg-surface p-0.5', disabled && 'opacity-50', className)}
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={disabled}
            onClick={() => onChange(opt.value)}
            className={cn(
              'focus-ring inline-flex h-7 items-center gap-1.5 whitespace-nowrap rounded px-2.5 text-xs font-medium transition-[color,background-color,box-shadow,transform] duration-200 ease-out-soft enabled:active:scale-[0.97] disabled:cursor-not-allowed',
              active ? 'bg-hover text-fg shadow-sm' : 'text-muted enabled:hover:text-fg',
            )}
          >
            {opt.label}
            {opt.count != null && <span className={cn('tabular-nums', active ? 'text-muted' : 'text-faint')}>{opt.count}</span>}
          </button>
        );
      })}
    </div>
  );
}
