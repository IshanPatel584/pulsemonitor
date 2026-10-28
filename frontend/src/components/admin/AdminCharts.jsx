import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { usePreferences } from '../../context/PreferencesContext';
import ChartTooltip from '../charts/ChartTooltip';
import { axisProps, color, gridProps } from '../charts/chartTheme';

// Analytics days are UTC calendar days ("2026-10-26"); label them in UTC too so
// a day never shifts to its neighbour in the viewer's timezone.
const dayLabel = (date) => new Date(`${date}T00:00:00Z`).toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' });
const fullDayLabel = (date) =>
  new Date(`${date}T00:00:00Z`).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });

const HEIGHT = 220;
const xAxis = <XAxis dataKey="date" tickFormatter={dayLabel} {...axisProps} minTickGap={24} />;
const legendProps = { iconType: 'circle', iconSize: 7, wrapperStyle: { fontSize: 11, color: color('muted'), paddingTop: 4 } };

function useAnimate() {
  return !usePreferences().motionReduced;
}

export function RegistrationsChart({ series }) {
  const animate = useAnimate();
  return (
    <ResponsiveContainer width="100%" height={HEIGHT}>
      <BarChart data={series} margin={{ top: 8, right: 4, left: -16, bottom: 0 }}>
        <CartesianGrid {...gridProps} />
        {xAxis}
        <YAxis allowDecimals={false} {...axisProps} width={44} />
        <Tooltip cursor={{ fill: color('hover') }} content={<ChartTooltip labelFormatter={fullDayLabel} />} />
        <Bar dataKey="registrations" name="Sign-ups" fill={color('accent')} radius={[3, 3, 0, 0]} maxBarSize={28} isAnimationActive={animate} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function IncidentsChart({ series }) {
  const animate = useAnimate();
  return (
    <ResponsiveContainer width="100%" height={HEIGHT}>
      <BarChart data={series} margin={{ top: 8, right: 4, left: -16, bottom: 0 }}>
        <CartesianGrid {...gridProps} />
        {xAxis}
        <YAxis allowDecimals={false} {...axisProps} width={44} />
        <Tooltip cursor={{ fill: color('hover') }} content={<ChartTooltip labelFormatter={fullDayLabel} />} />
        <Legend {...legendProps} />
        <Bar dataKey="incidentsOpened" name="Opened" fill={color('danger')} radius={[3, 3, 0, 0]} maxBarSize={18} isAnimationActive={animate} />
        <Bar dataKey="incidentsResolved" name="Resolved" fill={color('success')} radius={[3, 3, 0, 0]} maxBarSize={18} isAnimationActive={animate} />
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Days outside check-result retention have null counts and render as gaps, not zeros. */
export function ChecksChart({ series }) {
  const animate = useAnimate();
  return (
    <ResponsiveContainer width="100%" height={HEIGHT}>
      <BarChart data={series} margin={{ top: 8, right: 4, left: -8, bottom: 0 }}>
        <CartesianGrid {...gridProps} />
        {xAxis}
        <YAxis allowDecimals={false} {...axisProps} width={52} />
        <Tooltip
          cursor={{ fill: color('hover') }}
          content={
            <ChartTooltip
              labelFormatter={fullDayLabel}
              valueFormatter={(v) => (v == null ? 'No data' : v.toLocaleString())}
              extra={(row) =>
                row.checksTotal ? (
                  <div className="flex justify-between gap-6 border-t border-line pt-1 text-muted">
                    <span>Success rate</span>
                    <span className="font-mono tabular-nums text-fg">{((row.checksSuccess / row.checksTotal) * 100).toFixed(1)}%</span>
                  </div>
                ) : null
              }
            />
          }
        />
        <Legend {...legendProps} />
        <Bar dataKey="checksSuccess" name="Successful" stackId="checks" fill={color('success')} maxBarSize={28} isAnimationActive={animate} />
        <Bar dataKey="checksFailure" name="Failed" stackId="checks" fill={color('danger')} radius={[3, 3, 0, 0]} maxBarSize={28} isAnimationActive={animate} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function ResponseTrendChart({ series }) {
  const animate = useAnimate();
  const points = series.filter((d) => d.avgResponseTime != null).length;
  return (
    <ResponsiveContainer width="100%" height={HEIGHT}>
      <LineChart data={series} margin={{ top: 8, right: 4, left: -4, bottom: 0 }}>
        <CartesianGrid {...gridProps} />
        {xAxis}
        <YAxis {...axisProps} width={56} tickFormatter={(v) => `${v} ms`} />
        <Tooltip
          cursor={{ stroke: color('line-strong'), strokeWidth: 1 }}
          content={<ChartTooltip labelFormatter={fullDayLabel} valueFormatter={(v) => (v == null ? 'No data' : `${v} ms`)} />}
        />
        <Line
          type="monotone"
          dataKey="avgResponseTime"
          name="Average"
          stroke={color('accent')}
          strokeWidth={1.75}
          // Isolated days have no neighbour to draw a line to, so show them as dots.
          dot={points < 2 ? { r: 3, strokeWidth: 0, fill: color('accent') } : false}
          activeDot={{ r: 3.5, strokeWidth: 0, fill: color('accent') }}
          connectNulls={false}
          isAnimationActive={animate}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

const STATUS_SLICES = [
  { key: 'up', label: 'Up', token: 'success' },
  { key: 'down', label: 'Down', token: 'danger' },
  { key: 'unknown', label: 'Not checked yet', token: 'faint' },
];

export function StatusDonut({ monitors }) {
  const animate = useAnimate();
  const data = STATUS_SLICES.map((s) => ({ ...s, value: monitors[s.key] ?? 0 })).filter((s) => s.value > 0);

  return (
    // Stacked (donut above legend) so it fits the narrow one-third-width card;
    // the legend rows stretch to the card width instead of using fixed columns.
    <div className="flex flex-col items-center gap-5">
      <div className="relative h-[180px] w-[180px] shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="label"
              innerRadius={58}
              outerRadius={82}
              paddingAngle={data.length > 1 ? 2 : 0}
              stroke="none"
              isAnimationActive={animate}
            >
              {data.map((s) => (
                <Cell key={s.key} fill={color(s.token)} />
              ))}
            </Pie>
            <Tooltip content={<ChartTooltip labelFormatter={() => 'Monitors'} />} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-semibold tabular-nums text-fg">{monitors.total}</span>
          <span className="text-2xs text-muted">monitors</span>
        </div>
      </div>
      <ul className="w-full max-w-xs space-y-2 text-sm">
        {STATUS_SLICES.map((s) => {
          const value = monitors[s.key] ?? 0;
          return (
            <li key={s.key} className="flex items-center gap-2.5">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: color(s.token) }} aria-hidden />
              <span className="min-w-0 flex-1 truncate text-muted">{s.label}</span>
              <span className="font-medium tabular-nums text-fg">{value}</span>
              <span className="w-10 shrink-0 text-right text-xs tabular-nums text-faint">
                {monitors.total ? `${Math.round((value / monitors.total) * 100)}%` : '—'}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
