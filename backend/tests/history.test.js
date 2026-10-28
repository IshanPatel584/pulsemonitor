const mongoose = require("mongoose");
const CheckResult = require("../models/CheckResult");
const Monitor = require("../models/Monitor");
const { connectTestDb, clearTestDb, closeTestDb } = require("./helpers/db");
const { signedInAgent, validMonitor } = require("./helpers/auth");

beforeAll(connectTestDb);
afterEach(clearTestDb);
afterAll(closeTestDb);

const minutesAgo = (m) => new Date(Date.now() - m * 60_000);

function check(monitor, fields) {
  return CheckResult.create({
    monitorId: monitor._id,
    userId: monitor.userId,
    checkedAt: new Date(),
    statusCode: 200,
    responseTime: 120,
    success: true,
    error: null,
    ...fields,
  });
}

describe("GET /api/monitors/:id/history", () => {
  test("returns only that monitor's check results", async () => {
    const { agent, userId } = await signedInAgent();
    const a = await Monitor.create({ userId, ...validMonitor({ name: "A" }) });
    const b = await Monitor.create({ userId, ...validMonitor({ name: "B" }) });
    await check(a, { responseTime: 101 });
    await check(a, { responseTime: 102 });
    await check(b, { responseTime: 999 });

    const res = await agent.get(`/api/monitors/${a._id}/history`);

    expect(res.status).toBe(200);
    expect(res.body.checkresult).toHaveLength(2);
    expect(res.body.checkresult.every((c) => c.monitorId === String(a._id))).toBe(true);
    expect(res.body.checkresult.map((c) => c.responseTime).sort()).toEqual([101, 102]);
  });

  test("includes failed checks with their status code and error", async () => {
    const { agent, userId } = await signedInAgent();
    const monitor = await Monitor.create({ userId, ...validMonitor() });
    await check(monitor, { success: false, statusCode: null, responseTime: null, error: "Timed out after 10000 ms" });

    const [result] = (await agent.get(`/api/monitors/${monitor._id}/history`)).body.checkresult;

    expect(result).toMatchObject({ success: false, statusCode: null, responseTime: null, error: "Timed out after 10000 ms" });
  });

  test("sorts history newest first", async () => {
    const { agent, userId } = await signedInAgent();
    const monitor = await Monitor.create({ userId, ...validMonitor() });
    await check(monitor, { checkedAt: minutesAgo(2), responseTime: 2 });
    await check(monitor, { checkedAt: minutesAgo(0), responseTime: 0 });
    await check(monitor, { checkedAt: minutesAgo(5), responseTime: 5 });

    const res = await agent.get(`/api/monitors/${monitor._id}/history`);

    expect(res.body.checkresult.map((c) => c.responseTime)).toEqual([0, 2, 5]);
  });

  test("returns 404 for another user's monitor and never exposes its results", async () => {
    const alice = await signedInAgent();
    const bob = await signedInAgent();
    const monitor = await Monitor.create({ userId: alice.userId, ...validMonitor() });
    await check(monitor);

    const res = await bob.agent.get(`/api/monitors/${monitor._id}/history`);

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: "Monitor not found" });
    expect(res.body.checkresult).toBeUndefined();
  });

  test("does not include check results stored under another user for the same monitor id", async () => {
    const alice = await signedInAgent();
    const bob = await signedInAgent();
    const monitor = await Monitor.create({ userId: alice.userId, ...validMonitor() });
    await check(monitor, { responseTime: 1 });
    await CheckResult.create({ monitorId: monitor._id, userId: bob.userId, checkedAt: new Date(), statusCode: 200, responseTime: 2, success: true });

    const res = await alice.agent.get(`/api/monitors/${monitor._id}/history`);

    expect(res.body.checkresult.map((c) => c.responseTime)).toEqual([1]);
  });

  test("returns 404 for a nonexistent monitor", async () => {
    const { agent } = await signedInAgent();
    const res = await agent.get(`/api/monitors/${new mongoose.Types.ObjectId()}/history`);
    expect(res.status).toBe(404);
  });

  test("returns 400 for a malformed id", async () => {
    const { agent } = await signedInAgent();
    const res = await agent.get("/api/monitors/not-an-id/history");
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: "Invalid monitor ID" });
  });

  test("returns an empty history for a monitor that has not been checked", async () => {
    const { agent, userId } = await signedInAgent();
    const monitor = await Monitor.create({ userId, ...validMonitor() });
    const res = await agent.get(`/api/monitors/${monitor._id}/history`);
    expect(res.status).toBe(200);
    expect(res.body.checkresult).toEqual([]);
  });
});
