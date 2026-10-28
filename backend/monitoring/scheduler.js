const Monitor = require("../models/Monitor");
const CheckResult = require("../models/CheckResult");
const Incident = require("../models/Incident");
const { performCheck } = require("./httpCheck");
const { decryptHeaders } = require("./credentials");

// How often the scheduler looks for monitors that are due. A monitor is due
// once `interval` seconds have passed since its last check started.
const TICK_MS = 5000;
// Upper bound on checks running at the same time across all users.
const MAX_CONCURRENT_CHECKS = Number(process.env.MONITOR_MAX_CONCURRENCY) || 10;

// State lives on globalThis so re-requiring this module (tests, hot reload)
// reuses the running scheduler instead of starting a second one.
const STATE_KEY = Symbol.for("pulsemonitor.scheduler");
const state = (globalThis[STATE_KEY] ??= { timer: null, ticking: false, inFlight: new Set() });

async function runCheck(monitor) {
  const id = String(monitor._id);
  state.inFlight.add(id);

  try {
    // Saved header values are decrypted only here, for this one request. If they
    // can't be (key missing or changed), the check fails without being sent.
    let headers;
    let result;
    try {
      headers = decryptHeaders(monitor._id, monitor.headers);
    } catch (err) {
      result = { checkedAt: new Date(), statusCode: null, responseTime: null, error: err.message };
    }
    result ??= await performCheck({ ...monitor, headers });
    const success = result.statusCode === monitor.expectedStatusCode;
    const error = success
      ? null
      : result.error ?? `Expected status ${monitor.expectedStatusCode}, got ${result.statusCode}`;

    await CheckResult.create({
      monitorId: monitor._id,
      userId: monitor.userId,
      checkedAt: result.checkedAt,
      statusCode: result.statusCode,
      responseTime: result.responseTime,
      success,
      error,
    });

    // Only update the exact monitor that was checked: same id, same owner, and
    // unchanged URL/method/expected status. If the owner edited it mid-check,
    // this stale result is not applied and the monitor is re-checked next tick.
    const updateResult = await Monitor.updateOne(
  {
    _id: monitor._id,
    userId: monitor.userId,
    url: monitor.url,
    method: monitor.method,
    expectedStatusCode: monitor.expectedStatusCode,
  },
  {
    $set: {
      status: success ? "up" : "down",
      lastCheckedAt: result.checkedAt,
      lastStatusCode: result.statusCode,
      lastResponseTime: result.responseTime,
      lastError: error,
    },
  },
);

if (updateResult.matchedCount > 0) {
  const openIncident = await Incident.findOne({
    monitorId: monitor._id,
    userId: monitor.userId,
    status: "open",
  });

  if (!success && !openIncident) {
    await Incident.create({
      monitorId: monitor._id,
      userId: monitor.userId,
      startedAt: result.checkedAt,
      status: "open",
      reason: error || "Monitor check failed",
    });
  }

  if (success && openIncident) {
    openIncident.status = "resolved";
    openIncident.resolvedAt = result.checkedAt;
    await openIncident.save();
  }
}
  } catch (err) {
    console.error(`[monitor] could not record check for ${id}: ${err.message}`);
  } finally {
    state.inFlight.delete(id);
  }
}

async function tick() {
  // Skip if the previous tick's query is still running.
  if (state.ticking) return;
  state.ticking = true;

  try {
    const now = Date.now();
    // Oldest checks first (never-checked monitors sort first), so no monitor starves.
    const monitors = await Monitor.find({}, "userId url method interval expectedStatusCode lastCheckedAt headers")
      .sort({ lastCheckedAt: 1 })
      .lean();

    for (const monitor of monitors) {
      if (state.inFlight.size >= MAX_CONCURRENT_CHECKS) break;
      // A check for this monitor is still running: never overlap.
      if (state.inFlight.has(String(monitor._id))) continue;

      const last = monitor.lastCheckedAt ? new Date(monitor.lastCheckedAt).getTime() : 0;
      if (now - last >= monitor.interval * 1000) {
        runCheck(monitor); // not awaited: checks run in parallel, bounded above
      }
    }
  } catch (err) {
    console.error(`[monitor] scheduler tick failed: ${err.message}`);
  } finally {
    state.ticking = false;
  }
}

/** Starts the scheduler once per process. Returns false if it was already running. */
function startScheduler() {
  if (state.timer) return false;
  state.timer = setInterval(tick, TICK_MS);
  tick();
  console.log(`[monitor] scheduler started (tick ${TICK_MS / 1000}s, max ${MAX_CONCURRENT_CHECKS} concurrent checks)`);
  return true;
}

function stopScheduler() {
  clearInterval(state.timer);
  state.timer = null;
}

/** Read-only snapshot for the admin System Health page. */
function schedulerStatus() {
  return {
    running: Boolean(state.timer),
    checksInFlight: state.inFlight.size,
    tickSeconds: TICK_MS / 1000,
    maxConcurrentChecks: MAX_CONCURRENT_CHECKS,
  };
}

// runCheck and tick are exported for unit tests; the app only uses start/stop.
module.exports = { startScheduler, stopScheduler, runCheck, tick, schedulerStatus };
