// ---------------------------------------------------------------------------
// ILLUSTRATIVE DEMO DATA for the public landing / auth pages only.
//
// These fixed example values are not live metrics, are never read from or sent
// to the API, and are always shown next to a visible "Demo data" label. The real
// dashboard (Overview, Monitors, Incidents, Analytics) never imports this file.
// ---------------------------------------------------------------------------

const START = Date.UTC(2026, 0, 12, 8, 0);
const STEP = 10 * 60_000;

const RESPONSE_MS = [
  132, 128, 141, 137, 129, 146, 152, 139, 133, 127, 144, 158, 171, 196, 214, 188, 162, 149,
  141, 136, 131, 143, 150, 138, 134, 129, 137, 145, 140, 133, 128, 135, 142, 139, 131, 136,
];

export const DEMO_RESPONSE_SERIES = RESPONSE_MS.map((avg, i) => ({ time: START + i * STEP, avg }));
export const DEMO_RESPONSE_DOMAIN = [DEMO_RESPONSE_SERIES[0].time, DEMO_RESPONSE_SERIES[DEMO_RESPONSE_SERIES.length - 1].time];

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const DAILY_FAILED = [0, 0, 3, 0, 0, 16, 0];
export const DEMO_UPTIME_DAYS = DAYS.map((label, i) => {
  const checks = 1440;
  const failed = DAILY_FAILED[i];
  return { time: START + i * 86_400_000, label, checks, failed, uptime: ((checks - failed) / checks) * 100 };
});

export const DEMO_STATS = [
  { label: 'Uptime', value: '99.81', unit: '%', hint: 'Last 7 days' },
  { label: 'Avg response', value: '146', unit: 'ms', hint: 'Last 6 hours' },
  { label: 'Monitors up', value: '3', unit: '/ 4', hint: '1 down' },
  { label: 'Open incidents', value: '1', unit: '', hint: 'Search API', tone: 'danger' },
];

export const DEMO_MONITORS = [
  { name: 'Checkout API', url: 'checkout.example.com/health', method: 'GET', status: 'up', response: '142 ms' },
  { name: 'Auth service', url: 'auth.example.com/health', method: 'GET', status: 'up', response: '88 ms' },
  { name: 'Search API', url: 'search.example.com/ping', method: 'GET', status: 'down', response: 'Failed' },
  { name: 'Order webhooks', url: 'hooks.example.com/orders', method: 'POST', status: 'up', response: '231 ms' },
];

export const DEMO_INCIDENTS = [
  { monitor: 'Search API', reason: 'Expected status 200, got 503', time: '10:42', status: 'open' },
  { monitor: 'Auth service', reason: 'Timed out after 10000 ms', time: '09:15', status: 'resolved', duration: '4m' },
  { monitor: 'Checkout API', reason: 'Connection refused', time: 'Sat 14:03', status: 'resolved', duration: '16m' },
];
