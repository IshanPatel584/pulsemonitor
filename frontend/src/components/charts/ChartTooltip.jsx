/** Shared tooltip body for Recharts `content` prop. */
export default function ChartTooltip({ active, payload, label, valueFormatter = (v) => v, labelFormatter = (l) => l, extra }) {
  if (!active || !payload?.length) return null;

  return (
    <div className="min-w-[140px] rounded-md border border-line bg-elevated px-3 py-2 text-xs shadow-popover">
      <div className="mb-1.5 text-muted">{labelFormatter(label)}</div>
      <div className="space-y-1">
        {payload.map((item) => (
          <div key={item.dataKey} className="flex items-center justify-between gap-6">
            <span className="flex items-center gap-2 text-muted">
              <span className="h-2 w-2 rounded-full" style={{ background: item.stroke ?? item.color }} />
              {item.name}
            </span>
            <span className="font-mono tabular-nums text-fg">{valueFormatter(item.value, item)}</span>
          </div>
        ))}
        {extra?.(payload[0].payload)}
      </div>
    </div>
  );
}
