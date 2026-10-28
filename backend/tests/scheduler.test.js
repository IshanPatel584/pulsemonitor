// The HTTP layer is mocked: no request ever leaves the process.
jest.mock("../monitoring/httpCheck", () => ({ performCheck: jest.fn() }));

const mongoose = require("mongoose");
const { performCheck } = require("../monitoring/httpCheck");
const { runCheck, tick } = require("../monitoring/scheduler");
const CheckResult = require("../models/CheckResult");
const Incident = require("../models/Incident");
const Monitor = require("../models/Monitor");
const { connectTestDb, clearTestDb, closeTestDb } = require("./helpers/db");
const { validMonitor } = require("./helpers/auth");

beforeAll(connectTestDb);
afterEach(clearTestDb);
afterAll(closeTestDb);

const T0 = new Date("2026-01-01T12:00:00Z");
const at = (seconds) => new Date(T0.getTime() + seconds * 1000);

const ok = (checkedAt = at(0)) => ({ checkedAt, statusCode: 200, responseTime: 87, error: null });
const wrongStatus = (checkedAt = at(0)) => ({ checkedAt, statusCode: 503, responseTime: 140, error: null });
const timeout = (checkedAt = at(0)) => ({ checkedAt, statusCode: null, responseTime: null, error: "Timed out after 10000 ms" });

async function makeMonitor(overrides) {
  const doc = await Monitor.create({ userId: new mongoose.Types.ObjectId(), ...validMonitor(overrides) });
  // The scheduler works on the lean projection it reads in tick().
  return Monitor.findById(doc._id).lean();
}

const reload = (monitor) => Monitor.findById(monitor._id).lean();

/** Polls until `predicate` resolves truthy; used where tick() starts checks without awaiting them. */
async function waitFor(predicate, timeoutMs = 2000) {
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    if (await predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error("Condition not met in time");
}

describe("runCheck", () => {
  test("a failed check creates an open incident and marks the monitor down", async () => {
    const monitor = await makeMonitor();
    performCheck.mockResolvedValueOnce(wrongStatus(at(0)));

    await runCheck(monitor);

    const incidents = await Incident.find({ monitorId: monitor._id }).lean();
    expect(incidents).toHaveLength(1);
    expect(incidents[0]).toMatchObject({
      status: "open",
      reason: "Expected status 200, got 503",
      startedAt: at(0),
      resolvedAt: null,
      userId: monitor.userId,
    });
    expect(await reload(monitor)).toMatchObject({
      status: "down",
      lastCheckedAt: at(0),
      lastStatusCode: 503,
      lastResponseTime: 140,
      lastError: "Expected status 200, got 503",
    });
  });

  test("repeated failures do not create duplicate open incidents", async () => {
    const monitor = await makeMonitor();
    performCheck.mockResolvedValueOnce(timeout(at(0))).mockResolvedValueOnce(timeout(at(60))).mockResolvedValueOnce(wrongStatus(at(120)));

    await runCheck(monitor);
    await runCheck(monitor);
    await runCheck(monitor);

    const incidents = await Incident.find({ monitorId: monitor._id }).lean();
    expect(incidents).toHaveLength(1);
    expect(incidents[0]).toMatchObject({ status: "open", startedAt: at(0), reason: "Timed out after 10000 ms" });
    expect(await CheckResult.countDocuments({ monitorId: monitor._id })).toBe(3);
  });

  test("a successful check resolves the open incident at the check time", async () => {
    const monitor = await makeMonitor();
    performCheck.mockResolvedValueOnce(timeout(at(0))).mockResolvedValueOnce(ok(at(60)));

    await runCheck(monitor);
    await runCheck(monitor);

    const incidents = await Incident.find({ monitorId: monitor._id }).lean();
    expect(incidents).toHaveLength(1);
    expect(incidents[0]).toMatchObject({ status: "resolved", startedAt: at(0), resolvedAt: at(60) });
    expect((await reload(monitor)).status).toBe("up");
  });

  test("a new failure after resolution opens a second incident", async () => {
    const monitor = await makeMonitor();
    performCheck.mockResolvedValueOnce(timeout(at(0))).mockResolvedValueOnce(ok(at(60))).mockResolvedValueOnce(timeout(at(120)));

    await runCheck(monitor);
    await runCheck(monitor);
    await runCheck(monitor);

    const incidents = await Incident.find({ monitorId: monitor._id }).sort({ startedAt: 1 }).lean();
    expect(incidents.map((i) => i.status)).toEqual(["resolved", "open"]);
  });

  test("a successful check does not create an incident", async () => {
    const monitor = await makeMonitor();
    performCheck.mockResolvedValueOnce(ok(at(0)));

    await runCheck(monitor);

    expect(await Incident.countDocuments()).toBe(0);
    expect(await reload(monitor)).toMatchObject({ status: "up", lastStatusCode: 200, lastResponseTime: 87, lastError: null });
  });

  test("records a check result for a failed check (no response)", async () => {
    const monitor = await makeMonitor();
    performCheck.mockResolvedValueOnce(timeout(at(0)));

    await runCheck(monitor);

    const results = await CheckResult.find({ monitorId: monitor._id }).lean();
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      userId: monitor.userId,
      checkedAt: at(0),
      statusCode: null,
      responseTime: null,
      success: false,
      error: "Timed out after 10000 ms",
    });
  });

  test("records a check result for an unexpected status code", async () => {
    const monitor = await makeMonitor();
    performCheck.mockResolvedValueOnce(wrongStatus(at(0)));

    await runCheck(monitor);

    const [result] = await CheckResult.find({ monitorId: monitor._id }).lean();
    expect(result).toMatchObject({ statusCode: 503, responseTime: 140, success: false, error: "Expected status 200, got 503" });
  });

  test("a stale result does not update a monitor that was edited during the check", async () => {
    const monitor = await makeMonitor();
    // Simulate the owner changing the URL while the request is in flight.
    performCheck.mockImplementationOnce(async () => {
      await Monitor.updateOne({ _id: monitor._id }, { url: "https://example.org/new-endpoint" });
      return timeout(at(0));
    });

    await runCheck(monitor);

    expect(await reload(monitor)).toMatchObject({
      url: "https://example.org/new-endpoint",
      status: "unknown",
      lastCheckedAt: null,
      lastError: null,
    });
    expect(await Incident.countDocuments()).toBe(0);
  });

  test("an unexpected error is logged and does not throw", async () => {
    const monitor = await makeMonitor();
    const consoleError = jest.spyOn(console, "error").mockImplementation(() => {});
    performCheck.mockRejectedValueOnce(new Error("boom"));

    await expect(runCheck(monitor)).resolves.toBeUndefined();
    expect(consoleError).toHaveBeenCalledWith(expect.stringContaining("boom"));
  });
});

describe("tick", () => {
  test("checks monitors whose interval has elapsed and skips the rest", async () => {
    const now = Date.now();
    const due = await makeMonitor({ name: "due" });
    const notDue = await makeMonitor({ name: "not due", interval: 300 });
    const neverChecked = await makeMonitor({ name: "never checked" });
    await Monitor.updateOne({ _id: due._id }, { lastCheckedAt: new Date(now - 61_000) });
    await Monitor.updateOne({ _id: notDue._id }, { lastCheckedAt: new Date(now - 120_000) });
    performCheck.mockImplementation(async () => ok(new Date()));

    await tick();
    await waitFor(async () => (await CheckResult.countDocuments()) === 2);

    const checkedUrls = performCheck.mock.calls.map(([m]) => String(m._id)).sort();
    expect(checkedUrls).toEqual([String(due._id), String(neverChecked._id)].sort());
  });

  test("does not start a second check for a monitor that is still being checked", async () => {
    const monitor = await makeMonitor();
    let finish;
    performCheck.mockImplementation(() => new Promise((resolve) => { finish = resolve; }));

    await tick();
    await waitFor(() => performCheck.mock.calls.length === 1);
    await tick(); // the first check is still pending
    expect(performCheck).toHaveBeenCalledTimes(1);

    finish(ok(new Date()));
    await waitFor(async () => (await reload(monitor)).status === "up");
  });
});
