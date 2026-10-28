/**
 * Aggregations over real check results (from GET /api/monitors/:id/history).
 * Every value here is derived from recorded checks — buckets without checks
 * stay null so charts show a gap instead of an invented value.
 */

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

const pad = (n) => String(n).padStart(2, '0');
const timeLabel = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
const dayLabel = (d) => d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
const weekdayLabel = (d) => d.toLocaleDateString(undefined, { weekday: 'short' });

export const TIME_RANGES = [
  { value: '24h', label: '24h', ms: DAY, buckets: 24, bucketLabel: timeLabel, text: 'last 24 hours' },
  { value: '7d', label: '7d', ms: 7 * DAY, buckets: 28, bucketLabel: (d) => `${weekdayLabel(d)} ${timeLabel(d)}`, text: 'last 7 days' },
  { value: '30d', label: '30d', ms: 30 * DAY, buckets: 30, bucketLabel: dayLabel, text: 'last 30 days' },
  { value: '90d', label: '90d', ms: 90 * DAY, buckets: 45, bucketLabel: dayLabel, text: 'last 90 days' },
];

export const rangeByValue = (value) => TIME_RANGES.find((r) => r.value === value) ?? TIME_RANGES[0];

export function checksBetween(checks, from, to) {
  return checks.filter((c) => c.checkedAt >= from && c.checkedAt <= to);
}

/** Successful checks ÷ all checks (failed checks included). null when there are no checks. */
export function uptimePercent(checks) {
  if (!checks.length) return null;
  return (checks.filter((c) => c.success).length / checks.length) * 100;
}

function percentile(sortedValues, p) {
  const index = Math.max(0, Math.ceil((p / 100) * sortedValues.length) - 1);
  return sortedValues[index];
}

/** Average and p95 of non-null response times. null when none. */
export function responseStats(checks) {
  const values = checks.map((c) => c.responseTime).filter((v) => v != null).sort((a, b) => a - b);
  if (!values.length) return null;
  return {
    avg: Math.round(values.reduce((sum, v) => sum + v, 0) / values.length),
    p95: percentile(values, 95),
    count: values.length,
  };
}

/**
 * Points for the response-time chart. Checks without a response time are
 * excluded. Up to `maxPoints` checks are plotted individually; beyond that they
 * are grouped into equal time buckets showing the average and p95.
 */
export function responseSeries(checks, { from, to, maxPoints = 240 }) {
  const timed = checks.filter((c) => c.responseTime != null);
  if (timed.length <= maxPoints) {
    return { bucketed: false, data: timed.map((c) => ({ time: c.checkedAt, avg: c.responseTime })) };
  }

  const size = (to - from) / maxPoints;
  const buckets = new Map();
  for (const c of timed) {
    const key = Math.min(maxPoints - 1, Math.floor((c.checkedAt - from) / size));
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(c.responseTime);
  }

  const data = [...buckets.entries()]
    .sort(([a], [b]) => a - b)
    .map(([key, values]) => {
      values.sort((a, b) => a - b);
      return {
        time: Math.round(from + (key + 0.5) * size),
        avg: Math.round(values.reduce((sum, v) => sum + v, 0) / values.length),
        p95: percentile(values, 95),
      };
    });
  return { bucketed: true, data };
}

/**
 * Time-axis bounds for a series inside [from, to]. When history is shorter than
 * the window (e.g. a monitor created an hour ago), start just before the first
 * point instead of squeezing every point against the right edge.
 */
export function fitDomain(points, from, to) {
  if (!points.length) return [from, to];
  const start = Math.max(from, points[0].time);
  const padding = Math.max(60_000, (to - start) * 0.05);
  return [Math.max(from, start - padding), to];
}

/** Uptime per equal time bucket. Buckets with no checks have uptime: null. */
export function uptimeBuckets(checks, { from, to, count, label }) {
  const size = (to - from) / count;
  const buckets = Array.from({ length: count }, (_, i) => ({ time: Math.round(from + i * size), total: 0, failed: 0 }));

  for (const c of checks) {
    if (c.checkedAt < from || c.checkedAt > to) continue;
    const bucket = buckets[Math.min(count - 1, Math.floor((c.checkedAt - from) / size))];
    bucket.total += 1;
    if (!c.success) bucket.failed += 1;
  }

  return buckets.map((b, i) => ({
    time: b.time,
    label: label(new Date(b.time), i),
    checks: b.total,
    failed: b.failed,
    uptime: b.total ? ((b.total - b.failed) / b.total) * 100 : null,
  }));
}

/** Drops empty buckets before the first one with checks (history younger than the range). */
export function trimLeadingEmpty(buckets) {
  const first = buckets.findIndex((b) => b.checks > 0);
  return first <= 0 ? buckets : buckets.slice(first);
}

/** Uptime per calendar day for the last `days` days (local time), ending today. */
export function dailyUptime(checks, { days = 7, now = Date.now() } = {}) {
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const from = todayStart.getTime() - (days - 1) * DAY;
  // End exactly at next midnight so every bucket is exactly one day. (Ending 1 ms
  // earlier made buckets fractionally short, so later buckets started at 23:59:59.999
  // of the previous day and got that day's weekday label, e.g. "Sun, Sun".)
  const to = todayStart.getTime() + DAY;
  return uptimeBuckets(checks, {
    from,
    to,
    count: days,
    label: (d, i) => (i === days - 1 ? 'Today' : weekdayLabel(d)),
  });
}
