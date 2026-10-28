/**
 * Thin client for the PulseMonitor Express API.
 *
 * In development, requests go to the same origin (`/api/...`) and Vite proxies
 * them to http://localhost:5000 (see vite.config.js). That keeps the httpOnly
 * JWT cookie first-party and avoids CORS, which the backend doesn't enable.
 * Set VITE_API_URL to call the backend directly instead.
 */
const BASE_URL = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '');

const UNREACHABLE = 'Can’t reach the PulseMonitor API. Make sure the backend is running on http://localhost:5000.';
const TIMED_OUT = 'The PulseMonitor API took too long to respond. Please try again.';

// A hung backend must not leave the UI waiting forever.
const REQUEST_TIMEOUT_MS = 15_000;

export class ApiError extends Error {
  constructor(message, { status = 0, fieldErrors = {} } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.fieldErrors = fieldErrors;
  }
}

let onUnauthorized = null;

/** Called whenever a protected request returns 401 (session expired or missing). */
export function setUnauthorizedHandler(handler) {
  onUnauthorized = handler;
}

// Incremented on every sign-in, sign-out, and session switch. A response that
// belongs to an older session (e.g. a poll still in flight during logout) is
// recognisable by its generation, so it can't overwrite the new session's data
// or sign the new session out with a stale 401.
let sessionGeneration = 0;
export const getSessionGeneration = () => sessionGeneration;
export function bumpSessionGeneration() {
  sessionGeneration += 1;
  return sessionGeneration;
}

async function request(path, { method = 'GET', body } = {}) {
  const generation = sessionGeneration;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let res;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      method,
      credentials: 'include',
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
  } catch (err) {
    // Network failures and timeouts are not a sign-out: status 0 tells callers to retry.
    throw new ApiError(err?.name === 'AbortError' ? TIMED_OUT : UNREACHABLE);
  } finally {
    clearTimeout(timer);
  }

  const data = await res.json().catch(() => null);
  if (res.ok) return data;

  if (res.status === 401 && generation === sessionGeneration) onUnauthorized?.();

  // The backend answers with either { error: "..." } or { errors: { field: "message" | "" } }.
  const fieldErrors = Object.fromEntries(Object.entries(data?.errors ?? {}).filter(([, message]) => message));
  const message =
    data?.error ??
    Object.values(fieldErrors)[0] ??
    (data === null && res.status >= 500 ? UNREACHABLE : `Request failed (${res.status}).`);

  throw new ApiError(message, { status: res.status, fieldErrors });
}

export const api = {
  // Auth — success bodies are { user: "<id>" } for signup/login and { success: true } for logout.
  signup: ({ username, email, password }) => request('/api/signup', { method: 'POST', body: { username, email, password } }),
  login: ({ email, password }) => request('/api/login', { method: 'POST', body: { email, password } }),
  logout: () => request('/api/logout', { method: 'POST' }),
  // The signed-in user's own profile: { id, username, email, role }. The role
  // only decides which links to show; the server enforces it on every admin request.
  me: () => request('/api/me').then((data) => data?.user ?? null),

  // Monitors — note the backend registers list/create on the singular /api/monitor path.
  getMonitors: () => request('/api/monitor').then((data) => data?.monitors ?? []),
  createMonitor: (input) => request('/api/monitor', { method: 'POST', body: input }),
  updateMonitor: (id, input) => request(`/api/monitors/${id}`, { method: 'PATCH', body: input }).then((data) => data.monitor),
  deleteMonitor: (id) => request(`/api/monitors/${id}`, { method: 'DELETE' }),

  // Incidents — { incidents: [...] } for the signed-in user, newest startedAt first.
  getIncidents: () => request('/api/incidents').then((data) => (data?.incidents ?? []).map(normalizeIncident)),

  // History — the backend answers { checkresult: [...] } newest first, with every stored
  // check (no range/limit params), so ordering and range filtering happen client-side.
  getMonitorHistory: (id) =>
    request(`/api/monitors/${encodeURIComponent(id)}/history`).then((data) =>
      (data?.checkresult ?? []).map(normalizeCheck).sort((a, b) => a.checkedAt - b.checkedAt),
    ),
};

/** `{ page: 2, search: '' }` → `?page=2`; empty values are left out. */
function queryString(params = {}) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') query.set(key, String(value));
  }
  const text = query.toString();
  return text ? `?${text}` : '';
}

/**
 * Admin Portal endpoints (/api/admin/*). Every one requires an admin session on
 * the server: 401 when signed out, 403 for regular users.
 */
export const adminApi = {
  stats: () => request('/api/admin/stats'),
  analytics: (days) => request(`/api/admin/analytics${queryString({ days })}`),
  users: (params) => request(`/api/admin/users${queryString(params)}`),
  user: (id) => request(`/api/admin/users/${encodeURIComponent(id)}`),
  setUserRole: (id, role) => request(`/api/admin/users/${encodeURIComponent(id)}/role`, { method: 'PATCH', body: { role } }).then((data) => data.user),
  monitors: (params) => request(`/api/admin/monitors${queryString(params)}`),
  monitor: (id) => request(`/api/admin/monitors/${encodeURIComponent(id)}`),
  incidents: (params) => request(`/api/admin/incidents${queryString(params)}`),
  health: () => request('/api/admin/health'),
  settings: () => request('/api/admin/settings').then((data) => data.settings),
};

/**
 * Map an Incident document to the shape the incident components use.
 * `monitorId` is populated with { _id, name, url }; it is null when the
 * monitor has since been deleted.
 */
export function normalizeIncident(doc) {
  const monitor = doc.monitorId && typeof doc.monitorId === 'object' ? doc.monitorId : null;
  return {
    id: doc._id,
    monitorId: monitor?._id ?? (typeof doc.monitorId === 'string' ? doc.monitorId : null),
    monitorName: monitor?.name ?? null,
    monitorUrl: monitor?.url ?? null,
    status: doc.status === 'resolved' ? 'resolved' : 'open',
    reason: doc.reason ?? 'Monitor check failed',
    startedAt: Date.parse(doc.startedAt),
    resolvedAt: doc.resolvedAt ? Date.parse(doc.resolvedAt) : null,
  };
}

/** Map a CheckResult document to the shape the charts use. */
export function normalizeCheck(doc) {
  return {
    id: doc._id,
    checkedAt: Date.parse(doc.checkedAt),
    responseTime: typeof doc.responseTime === 'number' ? doc.responseTime : null,
    statusCode: doc.statusCode ?? null,
    success: Boolean(doc.success),
    error: doc.error ?? null,
  };
}

/** Map a Mongo monitor document to the shape the UI components use. */
export function normalizeMonitor(doc) {
  return {
    id: doc._id,
    name: doc.name,
    url: doc.url,
    method: doc.method,
    interval: doc.interval,
    expectedStatus: doc.expectedStatusCode,
    status: doc.status ?? 'unknown',
    // Latest check, written by the backend's monitoring engine. null until the
    // first check runs (or, for responseTime, when no HTTP response arrived).
    responseTime: typeof doc.lastResponseTime === 'number' ? doc.lastResponseTime : null,
    lastChecked: doc.lastCheckedAt ? Date.parse(doc.lastCheckedAt) : null,
    lastStatusCode: doc.lastStatusCode ?? null,
    lastError: doc.lastError ?? null,
    // Names of the custom request headers configured on this monitor. The API
    // never returns their values (they are encrypted and write-only).
    headerNames: (doc.headers ?? []).map((h) => h?.name).filter((name) => typeof name === 'string'),
    // Not provided by the backend yet; the UI shows "—".
    uptime: null,
    createdAt: doc.createdAt ? Date.parse(doc.createdAt) : null,
    updatedAt: doc.updatedAt ? Date.parse(doc.updatedAt) : null,
  };
}

/** Map Add/Edit form values to the request body the backend expects. */
export function toMonitorPayload(values) {
  return {
    name: values.name.trim(),
    url: values.url.trim(),
    method: values.method,
    interval: Number(values.interval),
    expectedStatusCode: Number(values.expectedStatus),
    // A saved header left blank is sent as { name } only: the server keeps its value.
    ...(Array.isArray(values.headers)
      ? { headers: values.headers.map((h) => ({ name: h.name.trim(), ...(h.value ? { value: h.value } : {}) })) }
      : {}),
  };
}
