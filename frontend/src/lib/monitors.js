// Must match the enum and `min: 60` interval in the backend's Monitor model.
export const HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];

export const CHECK_INTERVALS = [
  { value: 60, label: 'Every minute' },
  { value: 300, label: 'Every 5 minutes' },
  { value: 600, label: 'Every 10 minutes' },
  { value: 1800, label: 'Every 30 minutes' },
];

export const STATUS_ORDER = { down: 0, unknown: 1, up: 2 };

/**
 * Client-side validation for the Add Monitor form. Returns a map of
 * field -> message; an empty object means the input is valid.
 * Mirror these rules on the server when the API is built.
 */
export function validateMonitor(values, existingMonitors = [], editingId = null) {
  const errors = {};

  const name = values.name.trim();
  if (!name) errors.name = 'Monitor name is required.';
  else if (name.length < 2) errors.name = 'Use at least 2 characters.';
  else if (name.length > 60) errors.name = 'Keep the name under 60 characters.';
  else if (existingMonitors.some((m) => m.id !== editingId && m.name.toLowerCase() === name.toLowerCase())) {
    errors.name = 'A monitor with this name already exists.';
  }

  const url = values.url.trim();
  if (!url || url === 'https://' || url === 'http://') {
    errors.url = 'Endpoint URL is required.';
  } else {
    try {
      const parsed = new URL(url);
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        errors.url = 'URL must start with http:// or https://.';
      } else if (!parsed.hostname.includes('.') && parsed.hostname !== 'localhost') {
        errors.url = 'Enter a full hostname, e.g. api.example.com.';
      }
    } catch {
      errors.url = 'Enter a valid URL, e.g. https://api.example.com/health.';
    }
  }

  if (!HTTP_METHODS.includes(values.method)) errors.method = 'Select an HTTP method.';

  if (!CHECK_INTERVALS.some((i) => i.value === Number(values.interval))) {
    errors.interval = 'Select a check interval.';
  }

  const code = String(values.expectedStatus).trim();
  if (!/^\d{3}$/.test(code) || Number(code) < 100 || Number(code) > 599) {
    errors.expectedStatus = 'Use a 3-digit status code between 100 and 599.';
  }

  return errors;
}

export function sortMonitors(monitors, { key, direction }) {
  const dir = direction === 'asc' ? 1 : -1;
  return [...monitors].sort((a, b) => {
    let av = a[key];
    let bv = b[key];
    if (key === 'status') {
      av = STATUS_ORDER[av];
      bv = STATUS_ORDER[bv];
    }
    // Missing values always sort last, regardless of direction.
    if (av == null && bv == null) return 0;
    if (av == null) return 1;
    if (bv == null) return -1;
    if (typeof av === 'string') return av.localeCompare(bv) * dir;
    return (av - bv) * dir;
  });
}

export function filterMonitors(monitors, { query = '', status = 'all' }) {
  const q = query.trim().toLowerCase();
  return monitors.filter((m) => {
    if (status !== 'all' && m.status !== status) return false;
    if (!q) return true;
    return m.name.toLowerCase().includes(q) || m.url.toLowerCase().includes(q);
  });
}

export function countByStatus(monitors) {
  return monitors.reduce(
    (acc, m) => ({ ...acc, [m.status]: (acc[m.status] ?? 0) + 1 }),
    { up: 0, down: 0, unknown: 0 },
  );
}

// Custom request headers. Mirrors the server's rules (monitoring/credentials.js),
// which are authoritative; this only gives quicker feedback.
export const MAX_HEADERS = 10;
const HEADER_NAME = /^[A-Za-z0-9!#$%&'*+.^_`|~-]{1,64}$/;
const FORBIDDEN_HEADERS = new Set(['host', 'content-length', 'transfer-encoding', 'connection', 'keep-alive', 'upgrade', 'te', 'trailer', 'expect', 'via', 'forwarded', 'x-real-ip']);

/**
 * `rows`: [{ name, value, saved }] where `saved` means the server already has a
 * value (a blank value then keeps it). `originChanged`: the URL's host changed,
 * so saved values must be entered again. Returns one message or undefined.
 */
export function validateHeaders(rows = [], { originChanged = false } = {}) {
  if (rows.length > MAX_HEADERS) return `You can add at most ${MAX_HEADERS} headers.`;
  const seen = new Set();
  for (const row of rows) {
    const name = row.name.trim();
    const lower = name.toLowerCase();
    if (!name) return 'Every header needs a name.';
    if (!HEADER_NAME.test(name)) return `“${name}” isn’t a valid header name (letters, digits and - _ . only).`;
    if (FORBIDDEN_HEADERS.has(lower) || lower.startsWith('proxy-') || lower.startsWith('x-forwarded-')) return `The ${name} header can’t be set on a monitor.`;
    if (seen.has(lower)) return `The ${name} header is listed twice.`;
    seen.add(lower);
    if (!row.value) {
      if (!row.saved) return `Enter a value for the ${name} header.`;
      if (originChanged) return `The host changed: re-enter the ${name} value so it isn’t sent to a new host.`;
    } else if (/[^\t\x20-\x7e]/.test(row.value)) {
      return `The ${name} value contains characters that aren’t allowed (such as line breaks).`;
    } else if (row.value.length > 4096) {
      return `The ${name} value is too long (max 4096 characters).`;
    }
  }
  return undefined;
}
