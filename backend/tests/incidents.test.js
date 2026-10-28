const Incident = require("../models/Incident");
const Monitor = require("../models/Monitor");
const { connectTestDb, clearTestDb, closeTestDb } = require("./helpers/db");
const { app, request, signedInAgent, validMonitor } = require("./helpers/auth");

beforeAll(connectTestDb);
afterEach(clearTestDb);
afterAll(closeTestDb);

const minutesAgo = (m) => new Date(Date.now() - m * 60_000);

async function monitorFor(userId, overrides) {
  return Monitor.create({ userId, ...validMonitor(overrides) });
}

function incidentFor(monitor, fields) {
  return Incident.create({
    monitorId: monitor._id,
    userId: monitor.userId,
    status: "open",
    reason: "Expected status 200, got 503",
    startedAt: new Date(),
    ...fields,
  });
}

describe("GET /api/incidents", () => {
  test("returns 401 without a session", async () => {
    const res = await request(app).get("/api/incidents");
    expect(res.status).toBe(401);
  });

  test("returns an empty array for an account with no incidents", async () => {
    const { agent } = await signedInAgent();
    const res = await agent.get("/api/incidents");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ incidents: [] });
  });

  test("returns only the signed-in user's incidents", async () => {
    const alice = await signedInAgent();
    const bob = await signedInAgent();
    const aliceMonitor = await monitorFor(alice.userId, { name: "Alice API" });
    const bobMonitor = await monitorFor(bob.userId, { name: "Bob API" });
    await incidentFor(aliceMonitor, { reason: "alice outage" });
    await incidentFor(bobMonitor, { reason: "bob outage" });

    const res = await alice.agent.get("/api/incidents");

    expect(res.status).toBe(200);
    expect(res.body.incidents).toHaveLength(1);
    expect(res.body.incidents[0]).toMatchObject({ reason: "alice outage", userId: alice.userId });
  });

  test("sorts incidents newest first by startedAt", async () => {
    const { agent, userId } = await signedInAgent();
    const monitor = await monitorFor(userId);
    // Insert out of order so sorting, not insertion order, decides the result.
    await incidentFor(monitor, { reason: "middle", startedAt: minutesAgo(30), status: "resolved", resolvedAt: minutesAgo(20) });
    await incidentFor(monitor, { reason: "newest", startedAt: minutesAgo(5) });
    await incidentFor(monitor, { reason: "oldest", startedAt: minutesAgo(90), status: "resolved", resolvedAt: minutesAgo(80) });

    const res = await agent.get("/api/incidents");

    expect(res.body.incidents.map((i) => i.reason)).toEqual(["newest", "middle", "oldest"]);
  });

  test("populates the monitor's name and url", async () => {
    const { agent, userId } = await signedInAgent();
    const monitor = await monitorFor(userId, { name: "Checkout", url: "https://checkout.example.com/health" });
    await incidentFor(monitor, { status: "resolved", resolvedAt: new Date() });

    const [incident] = (await agent.get("/api/incidents")).body.incidents;

    expect(incident.monitorId).toEqual({ _id: String(monitor._id), name: "Checkout", url: "https://checkout.example.com/health" });
    expect(incident).toMatchObject({ status: "resolved", reason: "Expected status 200, got 503" });
    expect(incident.resolvedAt).toEqual(expect.any(String));
  });

  test("returns incidents of a deleted monitor with monitorId null", async () => {
    const { agent, userId } = await signedInAgent();
    const monitor = await monitorFor(userId);
    await incidentFor(monitor);
    await Monitor.deleteOne({ _id: monitor._id });

    const res = await agent.get("/api/incidents");

    expect(res.status).toBe(200);
    expect(res.body.incidents).toHaveLength(1);
    expect(res.body.incidents[0].monitorId).toBeNull();
  });
});
