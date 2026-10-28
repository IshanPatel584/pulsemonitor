const mongoose = require("mongoose");
const User = require("../models/User");
const Monitor = require("../models/Monitor");
const Incident = require("../models/Incident");
const CheckResult = require("../models/CheckResult");
const { schedulerStatus } = require("../monitoring/scheduler");
const { TIMEOUT_MS } = require("../monitoring/httpCheck");
const { loadAuthConfig } = require("../config/auth");

// Read-only admin views across all users, plus role changes. Every route here is
// mounted behind requiredAuth + requireRole("admin") (routes/adminRoutes.js).
// Monitors are never created or edited from here, so the SSRF rules in the
// Monitor model and the scheduler apply exactly as for their owners.

const DAY_MS = 24 * 60 * 60 * 1000;
const RETENTION_DAYS = Number(process.env.CHECK_RETENTION_DAYS) || 30;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;
const MAX_PAGE = 10_000;
const MAX_SEARCH_LENGTH = 100;
const ANALYTICS_RANGES = [7, 14, 30, 90];
const ROLES = ["client", "admin"];
const OBJECT_ID = /^[a-f0-9]{24}$/i;

class BadRequest extends Error {}

// ---- Request parsing -------------------------------------------------------

// Express 5 turns repeated keys into arrays; only plain strings are accepted.
function stringParam(query, name, { max = MAX_SEARCH_LENGTH } = {}) {
  const value = query[name];
  if (value === undefined || value === "") return null;
  if (typeof value !== "string") throw new BadRequest(`"${name}" must be a single value.`);
  const trimmed = value.trim();
  if (trimmed.length > max) throw new BadRequest(`"${name}" must be at most ${max} characters.`);
  return trimmed || null;
}

function intParam(query, name, { min, max, fallback }) {
  const raw = stringParam(query, name, { max: 10 });
  if (raw === null) return fallback;
  if (!/^\d+$/.test(raw)) throw new BadRequest(`"${name}" must be a whole number.`);
  const value = Number(raw);
  if (value < min || value > max) throw new BadRequest(`"${name}" must be between ${min} and ${max}.`);
  return value;
}

function enumParam(query, name, allowed) {
  const value = stringParam(query, name);
  if (value !== null && !allowed.includes(value)) {
    throw new BadRequest(`"${name}" must be one of: ${allowed.join(", ")}.`);
  }
  return value;
}

function idParam(value, label = "ID") {
  if (typeof value !== "string" || !OBJECT_ID.test(value)) throw new BadRequest(`Invalid ${label}.`);
  return new mongoose.Types.ObjectId(value);
}

function paging(query) {
  const page = intParam(query, "page", { min: 1, max: MAX_PAGE, fallback: 1 });
  const limit = intParam(query, "limit", { min: 1, max: MAX_LIMIT, fallback: DEFAULT_LIMIT });
  return { page, limit, skip: (page - 1) * limit };
}

/** `sort=field` (ascending) or `sort=-field` (descending), limited to `fields`. */
function sortParam(query, fields, fallback) {
  const raw = stringParam(query, "sort") ?? fallback;
  const desc = raw.startsWith("-");
  const key = desc ? raw.slice(1) : raw;
  if (!(key in fields)) {
    throw new BadRequest(`"sort" must be one of: ${Object.keys(fields).join(", ")} (prefix with - for descending).`);
  }
  const dir = desc ? -1 : 1;
  // _id as a tiebreaker keeps pages stable when many rows share a value.
  return { [fields[key]]: dir, ...(fields[key] === "_id" ? {} : { _id: dir }) };
}

const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const contains = (text) => new RegExp(escapeRegex(text), "i");

const pageInfo = ({ page, limit }, total) => ({ page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) });

/**
 * Wraps a handler: bad input → 400, anything else → 500 with a generic message.
 * Error details go to the server log only, never to the client.
 */
const handle = (label, fn) => async (req, res) => {
  try {
    await fn(req, res);
  } catch (err) {
    if (err instanceof BadRequest) return res.status(400).json({ error: err.message });
    console.error(`[admin] ${label} failed: ${err.message}`);
    res.status(500).json({ error: `Failed to ${label}.` });
  }
};

// ---- Response shapes (allow-lists: nothing else ever leaves the server) ----

// Users have no createdAt field; the ObjectId's embedded timestamp is the time
// the document was inserted, i.e. the registration time.
const registeredAt = (id) => new mongoose.Types.ObjectId(id).getTimestamp();

const SENSITIVE_PARAM = /(key|token|secret|pass|auth|sig|session|credential|code)/i;

/**
 * Hides query-string values that look like credentials (`?api_key=…`,
 * `?token=…`). URLs with user:password are already rejected by the Monitor model.
 */
function redactUrl(url) {
  try {
    const parsed = new URL(url);
    if (!parsed.search) return url;
    const params = [...parsed.searchParams].map(([name, value]) =>
      `${encodeURIComponent(name)}=${SENSITIVE_PARAM.test(name) ? "REDACTED" : encodeURIComponent(value)}`,
    );
    return `${parsed.origin}${parsed.pathname}?${params.join("&")}${parsed.hash}`;
  } catch {
    return url;
  }
}

const userSummary = (u) =>
  u && typeof u === "object" && u._id ? { id: u._id, username: u.username, email: u.email, role: u.role } : null;

const userView = (u) => ({
  id: u._id,
  username: u.username,
  email: u.email,
  role: u.role,
  createdAt: registeredAt(u._id),
});

const monitorView = (m) => ({
  id: m._id,
  name: m.name,
  url: redactUrl(m.url),
  method: m.method,
  interval: m.interval,
  expectedStatusCode: m.expectedStatusCode,
  status: m.status,
  lastCheckedAt: m.lastCheckedAt,
  lastStatusCode: m.lastStatusCode,
  lastResponseTime: m.lastResponseTime,
  lastError: m.lastError,
  createdAt: m.createdAt,
  owner: userSummary(m.userId),
  ownerId: m.userId && typeof m.userId === "object" && m.userId._id ? m.userId._id : m.userId,
});

const incidentView = (i) => {
  const monitor = i.monitorId && typeof i.monitorId === "object" && i.monitorId._id ? i.monitorId : null;
  return {
    id: i._id,
    status: i.status,
    reason: i.reason,
    startedAt: i.startedAt,
    resolvedAt: i.resolvedAt,
    monitor: monitor ? { id: monitor._id, name: monitor.name, url: redactUrl(monitor.url) } : null,
    owner: userSummary(i.userId),
  };
};

const checkView = (c) => ({
  id: c._id,
  checkedAt: c.checkedAt,
  statusCode: c.statusCode,
  responseTime: c.responseTime,
  success: c.success,
  error: c.error,
});

const USER_FIELDS = "username email role";
const OWNER_FIELDS = "username email role";

// ---- Dashboard -------------------------------------------------------------

async function countBy(model, field, match = {}) {
  const rows = await model.aggregate([{ $match: match }, { $group: { _id: `$${field}`, count: { $sum: 1 } } }]);
  return Object.fromEntries(rows.map((r) => [r._id, r.count]));
}

module.exports.getStats = handle("load admin statistics", async (req, res) => {
  const now = Date.now();
  const since = (days) => mongoose.Types.ObjectId.createFromTime(Math.floor((now - days * DAY_MS) / 1000));
  const dayAgo = new Date(now - DAY_MS);

  const [
    totalUsers,
    roles,
    newUsers7,
    newUsers30,
    ownerIds,
    monitorStatus,
    incidentStatus,
    checks24h,
    recentSignups,
    recentIncidents,
  ] = await Promise.all([
    User.countDocuments(),
    countBy(User, "role"),
    User.countDocuments({ _id: { $gte: since(7) } }),
    User.countDocuments({ _id: { $gte: since(30) } }),
    Monitor.distinct("userId"),
    countBy(Monitor, "status"),
    countBy(Incident, "status"),
    CheckResult.aggregate([
      { $match: { checkedAt: { $gte: dayAgo } } },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          success: { $sum: { $cond: ["$success", 1, 0] } },
          avgResponseTime: { $avg: "$responseTime" },
        },
      },
    ]),
    User.find().select(USER_FIELDS).sort({ _id: -1 }).limit(5).lean(),
    Incident.find()
      .sort({ startedAt: -1, _id: -1 })
      .limit(5)
      .populate("monitorId", "name url")
      .populate("userId", OWNER_FIELDS)
      .lean(),
  ]);

  const usersWithMonitors = ownerIds.length ? await User.countDocuments({ _id: { $in: ownerIds } }) : 0;
  const checks = checks24h[0];

  res.status(200).json({
    users: {
      total: totalUsers,
      admins: roles.admin ?? 0,
      clients: roles.client ?? 0,
      newLast7Days: newUsers7,
      newLast30Days: newUsers30,
      withMonitors: usersWithMonitors,
    },
    monitors: {
      total: (monitorStatus.up ?? 0) + (monitorStatus.down ?? 0) + (monitorStatus.unknown ?? 0),
      up: monitorStatus.up ?? 0,
      down: monitorStatus.down ?? 0,
      unknown: monitorStatus.unknown ?? 0,
    },
    incidents: {
      total: (incidentStatus.open ?? 0) + (incidentStatus.resolved ?? 0),
      open: incidentStatus.open ?? 0,
      resolved: incidentStatus.resolved ?? 0,
    },
    checksLast24h: {
      total: checks?.total ?? 0,
      success: checks?.success ?? 0,
      failure: (checks?.total ?? 0) - (checks?.success ?? 0),
      // null when no check in the window recorded a response time.
      avgResponseTime: checks?.avgResponseTime == null ? null : Math.round(checks.avgResponseTime),
    },
    recentSignups: recentSignups.map(userView),
    recentIncidents: recentIncidents.map(incidentView),
    generatedAt: new Date(now),
  });
});

/**
 * Daily series (UTC) for the last `days` days: registrations, incidents
 * opened/resolved, and check success/failure with average response time.
 * Check fields are null for days older than the check-result retention period,
 * because those results have been deleted — not because nothing happened.
 */
module.exports.getAnalytics = handle("load admin analytics", async (req, res) => {
  const days = intParam(req.query, "days", { min: 1, max: 90, fallback: 30 });
  if (!ANALYTICS_RANGES.includes(days)) throw new BadRequest(`"days" must be one of: ${ANALYTICS_RANGES.join(", ")}.`);

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const from = new Date(today.getTime() - (days - 1) * DAY_MS);
  const retentionStart = new Date(Date.now() - RETENTION_DAYS * DAY_MS);
  const dayKey = (expr) => ({ $dateToString: { format: "%Y-%m-%d", date: expr, timezone: "UTC" } });

  const [registrations, opened, resolved, checks] = await Promise.all([
    User.aggregate([
      { $match: { _id: { $gte: mongoose.Types.ObjectId.createFromTime(Math.floor(from.getTime() / 1000)) } } },
      { $group: { _id: dayKey({ $toDate: "$_id" }), count: { $sum: 1 } } },
    ]),
    Incident.aggregate([
      { $match: { startedAt: { $gte: from } } },
      { $group: { _id: dayKey("$startedAt"), count: { $sum: 1 } } },
    ]),
    Incident.aggregate([
      { $match: { resolvedAt: { $gte: from } } },
      { $group: { _id: dayKey("$resolvedAt"), count: { $sum: 1 } } },
    ]),
    CheckResult.aggregate([
      { $match: { checkedAt: { $gte: from } } },
      {
        $group: {
          _id: dayKey("$checkedAt"),
          total: { $sum: 1 },
          success: { $sum: { $cond: ["$success", 1, 0] } },
          avgResponseTime: { $avg: "$responseTime" },
        },
      },
    ]),
  ]);

  const byDay = (rows) => new Map(rows.map((r) => [r._id, r]));
  const reg = byDay(registrations);
  const open = byDay(opened);
  const res_ = byDay(resolved);
  const chk = byDay(checks);

  const series = [];
  for (let t = from.getTime(); t <= today.getTime(); t += DAY_MS) {
    const date = new Date(t).toISOString().slice(0, 10);
    // A day is covered when its end is still inside the retention window.
    const covered = t + DAY_MS > retentionStart.getTime();
    const c = chk.get(date);
    series.push({
      date,
      registrations: reg.get(date)?.count ?? 0,
      incidentsOpened: open.get(date)?.count ?? 0,
      incidentsResolved: res_.get(date)?.count ?? 0,
      checksTotal: covered ? (c?.total ?? 0) : null,
      checksSuccess: covered ? (c?.success ?? 0) : null,
      checksFailure: covered ? (c ? c.total - c.success : 0) : null,
      avgResponseTime: c?.avgResponseTime == null ? null : Math.round(c.avgResponseTime),
    });
  }

  res.status(200).json({ days, checkRetentionDays: RETENTION_DAYS, timezone: "UTC", series });
});

// ---- Users -----------------------------------------------------------------

module.exports.listUsers = handle("list users", async (req, res) => {
  const paged = paging(req.query);
  const search = stringParam(req.query, "search");
  const role = enumParam(req.query, "role", ROLES);
  const sort = sortParam(req.query, { createdAt: "_id", username: "username", email: "email", role: "role" }, "-createdAt");

  const filter = {};
  if (search) filter.$or = [{ username: contains(search) }, { email: contains(search) }];
  if (role) filter.role = role;

  const [users, total] = await Promise.all([
    User.find(filter).select(USER_FIELDS).sort(sort).skip(paged.skip).limit(paged.limit).lean(),
    User.countDocuments(filter),
  ]);

  const counts = users.length
    ? await countBy(Monitor, "userId", { userId: { $in: users.map((u) => u._id) } })
    : {};

  res.status(200).json({
    users: users.map((u) => ({ ...userView(u), monitorCount: counts[String(u._id)] ?? 0 })),
    ...pageInfo(paged, total),
  });
});

module.exports.getUser = handle("load user", async (req, res) => {
  const id = idParam(req.params.id, "user ID");
  const user = await User.findById(id).select(USER_FIELDS).lean();
  if (!user) return res.status(404).json({ error: "User not found" });

  const [monitors, monitorCount, incidentStatus, recentIncidents] = await Promise.all([
    Monitor.find({ userId: id }).sort({ createdAt: -1 }).limit(50).lean(),
    Monitor.countDocuments({ userId: id }),
    countBy(Incident, "status", { userId: id }),
    Incident.find({ userId: id }).sort({ startedAt: -1 }).limit(10).populate("monitorId", "name url").lean(),
  ]);

  res.status(200).json({
    user: userView(user),
    monitorCount,
    incidents: { open: incidentStatus.open ?? 0, resolved: incidentStatus.resolved ?? 0 },
    monitors: monitors.map((m) => {
      const { owner, ownerId, ...rest } = monitorView(m);
      return rest;
    }),
    recentIncidents: recentIncidents.map(({ userId, ...i }) => {
      const { owner, ...rest } = incidentView(i);
      return rest;
    }),
  });
});

/**
 * PATCH /api/admin/users/:id/role { role: "client" | "admin" }
 * Admins can't change their own role, so there is always at least one admin
 * left (the one making the request) and nobody locks themselves out.
 */
module.exports.updateUserRole = handle("update role", async (req, res) => {
  const id = idParam(req.params.id, "user ID");
  const role = req.body?.role;
  if (typeof role !== "string" || !ROLES.includes(role)) {
    throw new BadRequest(`"role" must be one of: ${ROLES.join(", ")}.`);
  }
  if (id.equals(req.user._id)) {
    return res.status(403).json({ error: "You can't change your own role. Ask another admin." });
  }

  const user = await User.findByIdAndUpdate(id, { role }, { new: true, runValidators: true }).select(USER_FIELDS).lean();
  if (!user) return res.status(404).json({ error: "User not found" });

  // Audit trail in the server log: who changed whom (ids only, no credentials).
  console.log(`[admin] role of user ${user._id} set to "${role}" by admin ${req.user._id}`);
  res.status(200).json({ user: userView(user) });
});

// ---- Monitors --------------------------------------------------------------

module.exports.listMonitors = handle("list monitors", async (req, res) => {
  const paged = paging(req.query);
  const search = stringParam(req.query, "search");
  const status = enumParam(req.query, "status", ["up", "down", "unknown"]);
  const ownerId = req.query.userId === undefined ? null : idParam(req.query.userId, "user ID");
  const sort = sortParam(
    req.query,
    { createdAt: "createdAt", name: "name", status: "status", lastCheckedAt: "lastCheckedAt", lastResponseTime: "lastResponseTime" },
    "-createdAt",
  );

  const filter = {};
  if (status) filter.status = status;
  if (ownerId) filter.userId = ownerId;
  if (search) {
    // Also match by owner name/email (bounded, so a broad search stays cheap).
    const owners = await User.find({ $or: [{ username: contains(search) }, { email: contains(search) }] }).select("_id").limit(1000).lean();
    filter.$or = [{ name: contains(search) }, { url: contains(search) }, { userId: { $in: owners.map((o) => o._id) } }];
  }

  const [monitors, total] = await Promise.all([
    Monitor.find(filter).sort(sort).skip(paged.skip).limit(paged.limit).populate("userId", OWNER_FIELDS).lean(),
    Monitor.countDocuments(filter),
  ]);

  res.status(200).json({ monitors: monitors.map(monitorView), ...pageInfo(paged, total) });
});

module.exports.getMonitor = handle("load monitor", async (req, res) => {
  const id = idParam(req.params.id, "monitor ID");
  const monitor = await Monitor.findById(id).populate("userId", OWNER_FIELDS).lean();
  if (!monitor) return res.status(404).json({ error: "Monitor not found" });

  const dayAgo = new Date(Date.now() - DAY_MS);
  const [checks, summary, incidents] = await Promise.all([
    CheckResult.find({ monitorId: id }).sort({ checkedAt: -1 }).limit(50).lean(),
    CheckResult.aggregate([
      { $match: { monitorId: id, checkedAt: { $gte: dayAgo } } },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          success: { $sum: { $cond: ["$success", 1, 0] } },
          avgResponseTime: { $avg: "$responseTime" },
        },
      },
    ]),
    Incident.find({ monitorId: id }).sort({ startedAt: -1 }).limit(10).lean(),
  ]);

  const s = summary[0];
  res.status(200).json({
    monitor: monitorView(monitor),
    checksLast24h: {
      total: s?.total ?? 0,
      success: s?.success ?? 0,
      failure: (s?.total ?? 0) - (s?.success ?? 0),
      avgResponseTime: s?.avgResponseTime == null ? null : Math.round(s.avgResponseTime),
    },
    recentChecks: checks.map(checkView),
    recentIncidents: incidents.map(({ monitorId, userId, ...i }) => {
      const { monitor: _m, owner, ...rest } = incidentView(i);
      return rest;
    }),
  });
});

// ---- Incidents -------------------------------------------------------------

module.exports.listIncidents = handle("list incidents", async (req, res) => {
  const paged = paging(req.query);
  const search = stringParam(req.query, "search");
  const status = enumParam(req.query, "status", ["open", "resolved"]);
  const monitorId = req.query.monitorId === undefined ? null : idParam(req.query.monitorId, "monitor ID");
  const ownerId = req.query.userId === undefined ? null : idParam(req.query.userId, "user ID");
  const sort = sortParam(req.query, { startedAt: "startedAt", resolvedAt: "resolvedAt", status: "status" }, "-startedAt");

  const filter = {};
  if (status) filter.status = status;
  if (monitorId) filter.monitorId = monitorId;
  if (ownerId) filter.userId = ownerId;
  if (search) {
    const monitors = await Monitor.find({ $or: [{ name: contains(search) }, { url: contains(search) }] }).select("_id").limit(1000).lean();
    filter.$or = [{ reason: contains(search) }, { monitorId: { $in: monitors.map((m) => m._id) } }];
  }

  const [incidents, total] = await Promise.all([
    Incident.find(filter)
      .sort(sort)
      .skip(paged.skip)
      .limit(paged.limit)
      .populate("monitorId", "name url")
      .populate("userId", OWNER_FIELDS)
      .lean(),
    Incident.countDocuments(filter),
  ]);

  res.status(200).json({ incidents: incidents.map(incidentView), ...pageInfo(paged, total) });
});

// ---- System ----------------------------------------------------------------

const DB_STATES = { 0: "disconnected", 1: "connected", 2: "connecting", 3: "disconnecting" };

module.exports.getHealth = handle("load system health", async (req, res) => {
  const now = Date.now();
  const database = { state: DB_STATES[mongoose.connection.readyState] ?? "unknown", pingMs: null };
  try {
    const started = process.hrtime.bigint();
    await mongoose.connection.db.admin().ping();
    database.pingMs = Number((process.hrtime.bigint() - started) / 1_000_000n);
  } catch {
    database.state = database.state === "connected" ? "unresponsive" : database.state;
  }

  const [lastCheck, checksLastHour, overdueMonitors, totalMonitors] = await Promise.all([
    CheckResult.findOne().sort({ checkedAt: -1 }).select("checkedAt").lean(),
    CheckResult.countDocuments({ checkedAt: { $gte: new Date(now - 60 * 60 * 1000) } }),
    // Never checked, or not checked for over twice the interval plus a minute.
    Monitor.countDocuments({
      $or: [
        { lastCheckedAt: null },
        { $expr: { $lt: ["$lastCheckedAt", { $subtract: [new Date(now), { $add: [{ $multiply: ["$interval", 2000] }, 60_000] }] }] } },
      ],
    }),
    Monitor.countDocuments(),
  ]);

  const memory = process.memoryUsage();
  res.status(200).json({
    database,
    scheduler: {
      ...schedulerStatus(),
      lastCheckAt: lastCheck?.checkedAt ?? null,
      checksLastHour,
      overdueMonitors,
      totalMonitors,
    },
    server: {
      uptimeSeconds: Math.round(process.uptime()),
      nodeVersion: process.version,
      memory: { rssBytes: memory.rss, heapUsedBytes: memory.heapUsed, heapTotalBytes: memory.heapTotal },
    },
    checkedAt: new Date(now),
  });
});

/**
 * Effective, non-secret configuration. These come from environment variables
 * and can't be changed at runtime; JWT_SECRET is never included.
 */
module.exports.getSettings = handle("load settings", async (req, res) => {
  const auth = loadAuthConfig();
  const { maxConcurrentChecks, tickSeconds } = schedulerStatus();
  res.status(200).json({
    settings: {
      environment: process.env.NODE_ENV || "development",
      sessionTtlSeconds: auth.ttlSeconds,
      cookieSameSite: auth.cookie.sameSite,
      cookieSecure: auth.cookie.secure,
      checkRetentionDays: RETENTION_DAYS,
      monitorTimeoutMs: TIMEOUT_MS,
      maxConcurrentChecks,
      schedulerTickSeconds: tickSeconds,
      minMonitorIntervalSeconds: 60,
      ssrfProtection: true,
    },
  });
});

module.exports.redactUrl = redactUrl;
