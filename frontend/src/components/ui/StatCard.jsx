import { cn } from '../../lib/cn';
import AnimatedNumber from './AnimatedNumber';

export default function StatCard({ label, value, unit, icon: Icon, hint, tone = 'default', loading = false }) {
  const toneClass = {
    default: 'text-fg',
    success: 'text-fg',
    danger: 'text-danger',
  }[tone];

  return (
    <div className="animate-rise rounded-lg border border-line bg-surface p-4 transition-[border-color,box-shadow] duration-200 ease-out-soft hover:border-line-strong hover:shadow-sm">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted">{label}</span>
        {Icon && (
          <span
            className={cn(
              'flex h-6 w-6 items-center justify-center rounded-md',
              tone === 'danger' ? 'bg-danger/10 text-danger' : tone === 'success' ? 'bg-success/10 text-success' : 'bg-hover text-muted',
            )}
          >
            <Icon className="h-3.5 w-3.5" aria-hidden />
          </span>
        )}
      </div>
      {loading ? (
        <div aria-busy="true" aria-label={`Loading ${label}`}>
          <div className="mt-3 h-8 w-16 skeleton rounded bg-hover" />
          <div className="mt-1.5 h-3 w-28 skeleton rounded bg-hover" />
        </div>
      ) : (
        <>
          <div className="mt-3 flex animate-fade-in items-baseline gap-1">
            <span className={cn('text-2xl font-semibold tabular-nums tracking-tight', toneClass)}>
              <AnimatedNumber value={value} />
            </span>
            {unit && <span className="text-sm text-muted">{unit}</span>}
          </div>
          {hint && <p className="mt-1 truncate text-xs text-muted">{hint}</p>}
        </>
      )}
    </div>
  );
}
