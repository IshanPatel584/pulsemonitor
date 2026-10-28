export function formatMs(ms) {
  if (ms == null) return '—';
  if (ms >= 1000) return `${(ms / 1000).toFixed(ms >= 10_000 ? 0 : 2)} s`;
  return `${Math.round(ms)} ms`;
}

export function formatPercent(value, digits = 2) {
  if (value == null) return '—';
  return `${value.toFixed(digits)}%`;
}

export function formatNumber(value) {
  return new Intl.NumberFormat().format(value);
}

export function formatRelative(ts, now = Date.now()) {
  if (ts == null) return '—';
  const s = Math.max(0, Math.round((now - ts) / 1000));
  if (s < 5) return 'just now';
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export function formatDuration(ms) {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  if (totalSec < 60) return `${totalSec}s`;
  const totalMin = Math.floor(totalSec / 60);
  const d = Math.floor(totalMin / 1440);
  const h = Math.floor((totalMin % 1440) / 60);
  const m = totalMin % 60;
  if (d) return `${d}d ${h}h`;
  if (h) return `${h}h ${m}m`;
  return `${m}m`;
}

const dateTimeFormat = new Intl.DateTimeFormat(undefined, {
  month: 'short',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

const timeFormat = new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' });

export const formatDateTime = (ts) => (ts == null ? '—' : dateTimeFormat.format(ts));
export const formatTime = (ts) => (ts == null ? '—' : timeFormat.format(ts));

export function formatInterval(seconds) {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${seconds / 60}m`;
  return `${seconds / 3600}h`;
}

export function displayUrl(url) {
  return url.replace(/^https?:\/\//, '').replace(/\/$/, '');
}

export function responseTone(ms) {
  if (ms == null) return 'text-faint';
  if (ms >= 800) return 'text-danger';
  if (ms >= 500) return 'text-warning';
  return 'text-fg';
}

export function uptimeTone(pct) {
  if (pct == null) return 'text-faint';
  if (pct < 99) return 'text-danger';
  if (pct < 99.9) return 'text-warning';
  return 'text-fg';
}

export function initials(name) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('');
}
