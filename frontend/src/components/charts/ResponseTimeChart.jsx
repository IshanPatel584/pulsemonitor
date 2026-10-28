import { useId } from 'react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { usePreferences } from '../../context/PreferencesContext';
import { formatDateTime } from '../../lib/format';
import ChartTooltip from './ChartTooltip';
import { axisProps, color, gridProps } from './chartTheme';

/** `bucketed` charts show Average + p95 per time bucket; otherwise one point per check. */
export function ResponseTimeLegend({ bucketed = false }) {
  return (
    <div className="flex items-center gap-4 text-xs text-muted">
      <span className="flex items-center gap-1.5">
        <span className="h-0.5 w-3 rounded bg-accent" /> {bucketed ? 'Average' : 'Response time'}
      </span>
      {bucketed && (
        <span className="flex items-center gap-1.5">
          <span className="w-3 border-t border-dashed border-faint" /> p95
        </span>
      )}
    </div>
  );
}

const pad = (n) => String(n).padStart(2, '0');

function tickFormatter(domain) {
  const spanMs = domain[1] - domain[0];
  return (t) => {
    const d = new Date(t);
    return spanMs <= 36 * 3_600_000 ? `${pad(d.getHours())}:${pad(d.getMinutes())}` : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };
}

/**
 * Response time over time. `data` items are { time (epoch ms), avg, p95? };
 * `domain` is the [from, to] window shown on the time axis.
 */
export default function ResponseTimeChart({ data, domain, bucketed = false, height = 240 }) {
  const fillId = `rt-${useId().replace(/:/g, '')}`;
  const { motionReduced } = usePreferences();
  // A lone point has no line to draw, so show it as a dot.
  const dot = data.length < 2 ? { r: 3, strokeWidth: 0, fill: color('accent') } : false;

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color('accent')} stopOpacity={0.16} />
            <stop offset="100%" stopColor={color('accent')} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid {...gridProps} />
        <XAxis
          dataKey="time"
          type="number"
          scale="time"
          domain={domain}
          allowDataOverflow
          tickFormatter={tickFormatter(domain)}
          {...axisProps}
          minTickGap={40}
        />
        <YAxis {...axisProps} width={52} tickFormatter={(v) => `${v} ms`} />
        <Tooltip
          cursor={{ stroke: color('line-strong'), strokeWidth: 1 }}
          content={<ChartTooltip valueFormatter={(v) => `${v} ms`} labelFormatter={(t) => formatDateTime(t)} />}
        />
        {bucketed && (
          <Area
            type="monotone"
            dataKey="p95"
            name="p95"
            stroke={color('faint')}
            strokeWidth={1.25}
            strokeDasharray="4 4"
            fill="none"
            dot={false}
            activeDot={{ r: 3, strokeWidth: 0, fill: color('faint') }}
            isAnimationActive={false}
          />
        )}
        <Area
          type="monotone"
          dataKey="avg"
          name={bucketed ? 'Average' : 'Response time'}
          stroke={color('accent')}
          strokeWidth={1.75}
          fill={`url(#${fillId})`}
          dot={dot}
          activeDot={{ r: 3.5, strokeWidth: 0, fill: color('accent') }}
          animationDuration={500}
          isAnimationActive={!motionReduced}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
