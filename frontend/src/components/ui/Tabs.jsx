import { cn } from '../../lib/cn';

export default function Tabs({ tabs, value, onChange, className }) {
  return (
    <div role="tablist" className={cn('flex gap-5 border-b border-line', className)}>
      {tabs.map((tab) => {
        const active = tab.value === value;
        return (
          <button
            key={tab.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(tab.value)}
            className={cn(
              'focus-ring -mb-px flex items-center gap-2 border-b-2 pb-2.5 pt-1 text-sm font-medium transition-colors duration-200 ease-out-soft',
              active ? 'border-accent text-fg' : 'border-transparent text-muted hover:text-fg',
            )}
          >
            {tab.label}
            {tab.count != null && (
              <span className={cn('rounded px-1.5 py-px text-2xs tabular-nums transition-colors duration-200', active ? 'bg-accent/15 text-accent' : 'bg-hover text-muted')}>
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
