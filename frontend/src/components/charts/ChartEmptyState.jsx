import { LineChart } from 'lucide-react';

/** Placeholder that keeps a chart card's height when there is no history to plot. */
export default function ChartEmptyState({ height = 240, title = 'No monitoring history yet', description, icon: Icon = LineChart }) {
  return (
    <div
      style={{ height }}
      className="flex animate-fade-in flex-col items-center justify-center rounded-md border border-dashed border-line px-6 text-center"
    >
      <Icon className="mb-2.5 h-5 w-5 text-faint" aria-hidden />
      <p className="text-sm font-medium text-fg">{title}</p>
      {description && <p className="mt-1 max-w-xs text-xs text-muted">{description}</p>}
    </div>
  );
}
