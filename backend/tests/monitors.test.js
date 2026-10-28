const mongoose = require("mongoose");
const Monitor = require("../models/Monitor");
const { connectTestDb, clearTestDb, closeTestDb } = require("./helpers/db");
const { signedInAgent, validMonitor } = require("./helpers/auth");

beforeAll(connectTestDb);
afterEach(clearTestDb);
afterAll(closeTestDb);

const missingId = () => new mongoose.Types.ObjectId().toString();

async function createMonitor(agent, overrides) {
  const res = await agent.post("/api/monitor").send(validMonitor(overrides));
  expect(res.status).toBe(200);
  return res.body.monitor;
}

describe("POST /api/monitor", () => {
  test("creates a monitor owned by the signed-in user", async () => {
    const { agent, userId } = await signedInAgent();
    const res = await agent.post("/api/monitor").send(validMonitor());

    expect(res.status).toBe(200);
    expect(res.body.monitor).toMatch(/^[a-f0-9]{24}$/);

    const doc = await Monitor.findById(res.body.monitor).lean();
    expect(doc).toMatchObject({
      name: "Example API",
      url: "https://example.com/health",
      method: "GET",
      interval: 60,
      expectedStatusCode: 200,
      status: "unknown",
      lastCheckedAt: null,
    });
    expect(String(doc.userId)).toBe(userId);
  });

  test("ignores a userId and status supplied in the body", async () => {
    const { agent, userId } = await signedInAgent();
    const res = await agent.post("/api/monitor").send({ ...validMonitor(), userId: missingId(), status: "up" });

    const doc = await Monitor.findById(res.body.monitor).lean();
    expect(String(doc.userId)).toBe(userId);
    expect(doc.status).toBe("unknown");
  });

  test.each([
    ["an invalid URL", { url: "not a url" }, "url", "Please enter a valid HTTP or HTTPS URL"],
    ["an unsupported protocol", { url: "ftp://example.com/file" }, "url", "Please enter a valid HTTP or HTTPS URL"],
    ["a localhost URL (SSRF)", { url: "http://localhost:5000/api" }, "url", "Local and internal hostnames cannot be monitored"],
    ["a cloud metadata IP (SSRF)", { url: "http://169.254.169.254/" }, "url", "Private, loopback, link-local, and reserved addresses cannot be monitored"],
    ["an interval below 60s", { interval: 30 }, "interval", expect.stringContaining("minimum")],
    ["a non-numeric interval", { interval: "soon" }, "interval", expect.any(String)],
    ["an expected status below 100", { expectedStatusCode: 99 }, "expectedStatusCode", expect.stringContaining("minimum")],
    ["an expected status above 599", { expectedStatusCode: 600 }, "expectedStatusCode", expect.stringContaining("maximum")],
    ["an unsupported method", { method: "TRACE" }, "method", expect.any(String)],
    ["a missing name", { name: "" }, "name", "Please enter Name for API"],
  ])("rejects %s", async (_label, overrides, field, message) => {
    const { agent } = await signedInAgent();
    const res = await agent.post("/api/monitor").send(validMonitor(overrides));

    expect(res.status).toBe(400);
    expect(res.body.errors[field]).toEqual(message);
    expect(await Monitor.countDocuments()).toBe(0);
  });
});

describe("GET /api/monitor", () => {
  test("lists only the signed-in user's monitors", async () => {
    const alice = await signedInAgent();
    const bob = await signedInAgent();
    await createMonitor(alice.agent, { name: "Alice 1" });
    await createMonitor(alice.agent, { name: "Alice 2" });
    await createMonitor(bob.agent, { name: "Bob 1" });

    const res = await alice.agent.get("/api/monitor");

    expect(res.status).toBe(200);
    expect(res.body.monitors.map((m) => m.name).sort()).toEqual(["Alice 1", "Alice 2"]);
    expect(res.body.monitors.every((m) => m.userId === alice.userId)).toBe(true);
  });

  test("returns an empty list for a new account", async () => {
    const { agent } = await signedInAgent();
    const res = await agent.get("/api/monitor");
    expect(res.status).toBe(200);
    expect(res.body.monitors).toEqual([]);
  });
});

describe("GET /api/monitors/:id", () => {
  test("returns the monitor to its owner", async () => {
    const { agent } = await signedInAgent();
    const id = await createMonitor(agent);

    const res = await agent.get(`/api/monitors/${id}`);

    expect(res.status).toBe(200);
    // The controller returns the single monitor under the `monitors` key.
    expect(res.body.monitors).toMatchObject({ _id: id, name: "Example API" });
  });

  test("returns 404 for a nonexistent monitor", async () => {
    const { agent } = await signedInAgent();
    const res = await agent.get(`/api/monitors/${missingId()}`);
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: "Monitor not found" });
  });

  test("returns 404 for another user's monitor", async () => {
    const alice = await signedInAgent();
    const bob = await signedInAgent();
    const id = await createMonitor(alice.agent);

    const res = await bob.agent.get(`/api/monitors/${id}`);
    expect(res.status).toBe(404);
  });

  test("returns 400 for a malformed id", async () => {
    const { agent } = await signedInAgent();
    const res = await agent.get("/api/monitors/not-an-id");
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: "Invalid monitor ID" });
  });
});

describe("PATCH /api/monitors/:id", () => {
  test("updates the owner's monitor and returns the new document", async () => {
    const { agent } = await signedInAgent();
    const id = await createMonitor(agent);

    const res = await agent
      .patch(`/api/monitors/${id}`)
      .send(validMonitor({ name: "Renamed", url: "https://example.org/status", method: "POST", interval: 300, expectedStatusCode: 201 }));

    expect(res.status).toBe(200);
    expect(res.body.monitor).toMatchObject({ name: "Renamed", url: "https://example.org/status", method: "POST", interval: 300, expectedStatusCode: 201 });
  });

  test("leaves fields that are not sent unchanged", async () => {
    const { agent } = await signedInAgent();
    const id = await createMonitor(agent);

    const res = await agent.patch(`/api/monitors/${id}`).send({ name: "Only the name" });

    expect(res.status).toBe(200);
    expect(res.body.monitor).toMatchObject({ name: "Only the name", url: "https://example.com/health", interval: 60 });
  });

  test("runs validators on update (rejects an SSRF URL)", async () => {
    const { agent } = await signedInAgent();
    const id = await createMonitor(agent);

    const res = await agent.patch(`/api/monitors/${id}`).send({ url: "http://127.0.0.1:27017/" });

    expect(res.status).toBe(400);
    expect((await Monitor.findById(id).lean()).url).toBe("https://example.com/health");
  });

  test("cannot change another user's monitor", async () => {
    const alice = await signedInAgent();
    const bob = await signedInAgent();
    const id = await createMonitor(alice.agent);

    const res = await bob.agent.patch(`/api/monitors/${id}`).send({ name: "Hijacked" });

    expect(res.status).toBe(404);
    expect((await Monitor.findById(id).lean()).name).toBe("Example API");
  });

  test("returns 404 for a nonexistent monitor and 400 for a malformed id", async () => {
    const { agent } = await signedInAgent();
    expect((await agent.patch(`/api/monitors/${missingId()}`).send({ name: "x" })).status).toBe(404);
    expect((await agent.patch("/api/monitors/not-an-id").send({ name: "x" })).status).toBe(400);
  });
});

describe("DELETE /api/monitors/:id", () => {
  test("deletes the owner's monitor", async () => {
    const { agent } = await signedInAgent();
    const id = await createMonitor(agent);

    const res = await agent.delete(`/api/monitors/${id}`);

    expect(res.status).toBe(200);
    expect(await Monitor.findById(id)).toBeNull();
  });

  test("cannot delete another user's monitor", async () => {
    const alice = await signedInAgent();
    const bob = await signedInAgent();
    const id = await createMonitor(alice.agent);

    const res = await bob.agent.delete(`/api/monitors/${id}`);

    expect(res.status).toBe(404);
    expect(await Monitor.findById(id)).not.toBeNull();
  });

  test("returns 404 for a nonexistent monitor and 400 for a malformed id", async () => {
    const { agent } = await signedInAgent();
    expect((await agent.delete(`/api/monitors/${missingId()}`)).status).toBe(404);
    expect((await agent.delete("/api/monitors/not-an-id")).status).toBe(400);
  });
});
