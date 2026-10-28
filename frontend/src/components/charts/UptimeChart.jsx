import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { usePreferences } from '../../context/PreferencesContext';
import ChartTooltip from './ChartTooltip';
import { axisProps, color, gridProps } from './chartTheme';

const barColor = (uptime) => (uptime >= 99.9 ? color('success') : uptime >= 99 ? color('warning') : color('danger'));

// Zoom the y-axis to the interesting range near 100%.
const domain = [(min) => Math.max(0, Math.floor((min - 0.15) * 10) / 10), 100];

const tooltip = (
  <ChartTooltip
    valueFormatter={(v) => (v == null ? 'No checks' : `${v.toFixed(2)}%`)}
    extra={(point) =>
      point.checks > 0 && (
        <div className="flex justify-between gap-6 text-muted">
          <span>Checks</span>
          <span className="font-mono text-fg">
            {point.checks} · {point.failed} failed
          </span>
        </div>
      )
    }
  />
);

/**
 * Uptime percentage as bars (`variant="bar"`) or a trend line. Items are
 * { time, label, uptime | null, checks, failed }; null uptime means no checks
 * in that period and is left as a gap.
 */
export default function UptimeChart({ data, height = 240, variant = 'bar' }) {
  const { motionReduced } = usePreferences();
  // Three ticks keep labels distinct when the axis is zoomed to a narrow band like 99.8–100%.
  const yAxis = <YAxis {...axisProps} width={52} domain={domain} tickCount={3} tickFormatter={(v) => `${v.toFixed(1)}%`} />;

  if (variant === 'line') {
    return (
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={data} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
          <CartesianGrid {...gridProps} />
          <XAxis dataKey="label" {...axisProps} minTickGap={28} interval="preserveStartEnd" />
          {yAxis}
          <Tooltip cursor={{ stroke: color('line-strong') }} content={tooltip} />
          <Line
            type="monotone"
            dataKey="uptime"
            name="Uptime"
            stroke={color('success')}
            strokeWidth={1.75}
            // Small dots keep isolated periods visible: periods with no checks are gaps, not interpolated.
            dot={{ r: 1.75, strokeWidth: 0, fill: color('success') }}
            activeDot={{ r: 3.5, strokeWidth: 0, fill: color('success') }}
            animationDuration={500}
            isAnimationActive={!motionReduced}
          />
        </LineChart>
      </ResponsiveContainer>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
        <CartesianGrid {...gridProps} />
        <XAxis dataKey="label" {...axisProps} />
        {yAxis}
        <Tooltip cursor={{ fill: color('hover') }} content={tooltip} />
        <Bar
          dataKey="uptime"
          name="Uptime"
          radius={[3, 3, 0, 0]}
          maxBarSize={30}
          // A 0% period still had checks, so keep a visible sliver; null (no checks) stays empty.
          minPointSize={(value) => (value == null ? 0 : 3)}
          animationDuration={500}
          isAnimationActive={!motionReduced}
        >
          {data.map((d) => (
            <Cell key={d.time} fill={barColor(d.uptime)} fillOpacity={0.85} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
