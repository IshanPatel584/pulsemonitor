const mongoose = require("mongoose");
const User = require("../models/User");
const Monitor = require("../models/Monitor");
const Incident = require("../models/Incident");
const CheckResult = require("../models/CheckResult");
const { connectTestDb, clearTestDb, closeTestDb } = require("./helpers/db");
const { app, request, signedInAgent, testCredentials, validMonitor } = require("./helpers/auth");

beforeAll(connectTestDb);
afterEach(clearTestDb);
afterAll(closeTestDb);

const minutesAgo = (m) => new Date(Date.now() - m * 60_000);
const daysAgo = (d) => new Date(Date.now() - d * 24 * 60 * 60_000);

/** Signs up through the API, then promotes the account directly in the test database. */
async function adminAgent(overrides) {
  const session = await signedInAgent(overrides);
  await User.updateOne({ _id: session.userId }, { role: "admin" });
  return session;
}

// Insert users without the API (and without bcrypt) for list/pagination tests.
async function insertUsers(count, make = (i) => ({})) {
  const docs = Array.from({ length: count }, (_, i) => ({
    username: `bulk${i}`,
    email: `bulk${i}@example.test`,
    password: "not-a-real-hash",
    ...make(i),
  }));
  return User.insertMany(docs);
}

const monitorFor = (userId, overrides) => Monitor.create({ userId, ...validMonitor(overrides) });

const incidentFor = (monitor, fields) =>
  Incident.create({
    monitorId: monitor._id,
    userId: monitor.userId,
    status: "open",
    reason: "Expected status 200, got 503",
    startedAt: new Date(),
    ...fields,
  });

const checkFor = (monitor, fields) =>
  CheckResult.create({
    monitorId: monitor._id,
    userId: monitor.userId,
    checkedAt: new Date(),
    statusCode: 200,
    responseTime: 100,
    success: true,
    ...fields,
  });

const ADMIN_GETS = [
  "/api/admin/stats",
  "/api/admin/analytics",
  "/api/admin/users",
  "/api/admin/monitors",
  "/api/admin/incidents",
  "/api/admin/health",
  "/api/admin/settings",
];

// ---------------------------------------------------------------------------

describe("authorization", () => {
  test.each(ADMIN_GETS)("GET %s returns 401 without a session", async (path) => {
    const res = await request(app).get(path);
    expect(res.status).toBe(401);
  });

  test.each(ADMIN_GETS)("GET %s returns 403 for a regular user", async (path) => {
    const { agent } = await signedInAgent();
    const res = await agent.get(path);
    expect(res.status).toBe(403);
    expect(res.body).toEqual({ error: expect.any(String) });
  });

  test.each(ADMIN_GETS)("GET %s returns 200 for an admin", async (path) => {
    const { agent } = await adminAgent();
    const res = await agent.get(path);
    expect(res.status).toBe(200);
  });

  test("detail and role routes are guarded before the ID is even parsed", async () => {
    const { agent, userId } = await signedInAgent();
    const id = new mongoose.Types.ObjectId();
    for (const path of [`/api/admin/users/${id}`, `/api/admin/monitors/${id}`, "/api/admin/users/not-an-id"]) {
      expect((await request(app).get(path)).status).toBe(401);
      expect((await agent.get(path)).status).toBe(403);
    }
    const anon = await request(app).patch(`/api/admin/users/${userId}/role`).send({ role: "admin" });
    expect(anon.status).toBe(401);
  });

  test("unknown admin paths don't reveal themselves to non-admins", async () => {
    const { agent } = await signedInAgent();
    expect((await request(app).get("/api/admin/does-not-exist")).status).toBe(401);
    expect((await agent.get("/api/admin/does-not-exist")).status).toBe(403);
    const admin = await adminAgent();
    expect((await admin.agent.get("/api/admin/does-not-exist")).status).toBe(404);
  });

  test("a demoted admin loses access on the very next request", async () => {
    const { agent, userId } = await adminAgent();
    expect((await agent.get("/api/admin/stats")).status).toBe(200);
    await User.updateOne({ _id: userId }, { role: "client" });
    expect((await agent.get("/api/admin/stats")).status).toBe(403);
  });

  test("a tampered or expired cookie is treated as signed out", async () => {
    const res = await request(app).get("/api/admin/stats").set("Cookie", "jwt=not.a.token");
    expect(res.status).toBe(401);
  });
});

describe("privilege escalation", () => {
  test("signup ignores role, even nested or as an operator", async () => {
    for (const role of ["admin", ["admin"], { $set: "admin" }]) {
      const res = await request(app).post("/api/signup").send({ ...testCredentials(), role });
      expect(res.status).toBe(200);
      const user = await User.findById(res.body.user).lean();
      expect(user.role).toBe("client");
    }
  });

  test("a regular user can't change any role, including their own", async () => {
    jest.spyOn(console, "log").mockImplementation(() => {});
    const { agent, userId } = await signedInAgent();
    const other = await signedInAgent();

    for (const target of [userId, other.userId]) {
      const res = await agent.patch(`/api/admin/users/${target}/role`).send({ role: "admin" });
      expect(res.status).toBe(403);
    }
    const roles = (await User.find({ _id: { $in: [userId, other.userId] } }).lean()).map((u) => u.role);
    expect(roles).toEqual(["client", "client"]);
    expect((await agent.get("/api/admin/users")).status).toBe(403);
  });

  test("there is no profile-update route to set a role through", async () => {
    const { agent, userId } = await signedInAgent();
    for (const method of ["patch", "put", "post"]) {
      const res = await agent[method]("/api/me").send({ role: "admin" });
      expect(res.status).toBe(404);
    }
    expect((await User.findById(userId).lean()).role).toBe("client");
  });

  test("monitor updates can't change the owner's role", async () => {
    const { agent, userId } = await signedInAgent();
    const monitor = await monitorFor(userId);
    await agent.patch(`/api/monitors/${monitor._id}`).send({ ...validMonitor(), role: "admin", userId: String(new mongoose.Types.ObjectId()) });
    expect((await User.findById(userId).lean()).role).toBe("client");
    expect(String((await Monitor.findById(monitor._id).lean()).userId)).toBe(userId);
  });
});

describe("GET /api/me", () => {
  test("returns 401 without a session", async () => {
    expect((await request(app).get("/api/me")).status).toBe(401);
  });

  test("returns the profile and role, never the password", async () => {
    const { agent, userId, credentials } = await signedInAgent();
    const res = await agent.get("/api/me");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      user: { id: userId, username: credentials.username, email: credentials.email, role: "client" },
    });
    expect(JSON.stringify(res.body)).not.toMatch(/password|\$2[aby]\$/);
  });

  test("reports the admin role for admins", async () => {
    const { agent } = await adminAgent();
    expect((await agent.get("/api/me")).body.user.role).toBe("admin");
  });
});

describe("GET /api/admin/stats", () => {
  test("works on an otherwise empty database", async () => {
    const { agent } = await adminAgent();
    const res = await agent.get("/api/admin/stats");
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      users: { total: 1, admins: 1, clients: 0, newLast7Days: 1, newLast30Days: 1, withMonitors: 0 },
      monitors: { total: 0, up: 0, down: 0, unknown: 0 },
      incidents: { total: 0, open: 0, resolved: 0 },
      checksLast24h: { total: 0, success: 0, failure: 0, avgResponseTime: null },
      recentIncidents: [],
    });
    expect(res.body.recentSignups).toHaveLength(1);
  });

  test("counts real data across all users", async () => {
    const { agent } = await adminAgent();
    const alice = await signedInAgent();
    const bob = await signedInAgent();
    // An "old" user, registered 40 days ago according to its ObjectId.
    await User.create({
      _id: mongoose.Types.ObjectId.createFromTime(Math.floor(daysAgo(40).getTime() / 1000)),
      username: "old",
      email: "old@example.test",
      password: "secret-1",
    });

    const up = await monitorFor(alice.userId, { name: "A" });
    await Monitor.updateOne({ _id: up._id }, { status: "up" });
    const down = await monitorFor(bob.userId, { name: "B" });
    await Monitor.updateOne({ _id: down._id }, { status: "down" });
    await monitorFor(bob.userId, { name: "C" });

    await incidentFor(down, { reason: "newest", startedAt: minutesAgo(1) });
    await incidentFor(down, { status: "resolved", startedAt: minutesAgo(60), resolvedAt: minutesAgo(30) });

    await checkFor(up, { responseTime: 100 });
    await checkFor(up, { responseTime: 300 });
    await checkFor(down, { success: false, statusCode: 503, responseTime: null });
    await checkFor(down, { success: false, checkedAt: daysAgo(2) }); // outside 24h

    const res = await agent.get("/api/admin/stats");

    expect(res.body.users).toEqual({ total: 4, admins: 1, clients: 3, newLast7Days: 3, newLast30Days: 3, withMonitors: 2 });
    expect(res.body.monitors).toEqual({ total: 3, up: 1, down: 1, unknown: 1 });
    expect(res.body.incidents).toEqual({ total: 2, open: 1, resolved: 1 });
    expect(res.body.checksLast24h).toEqual({ total: 3, success: 2, failure: 1, avgResponseTime: 200 });
    expect(res.body.recentIncidents[0]).toMatchObject({
      reason: "newest",
      status: "open",
      monitor: { name: "B" },
      owner: { id: bob.userId, email: bob.credentials.email },
    });
    // Newest first by registration time; the 40-day-old account comes last.
    expect(res.body.recentSignups.map((u) => u.email)).toEqual([
      bob.credentials.email,
      alice.credentials.email,
      expect.any(String),
      "old@example.test",
    ]);
  });

  test("never includes password hashes", async () => {
    const { agent } = await adminAgent();
    await signedInAgent();
    const body = JSON.stringify((await agent.get("/api/admin/stats")).body);
    expect(body).not.toMatch(/password|\$2[aby]\$/);
  });

  test("returns a generic 500 when the database fails", async () => {
    const { agent } = await adminAgent();
    jest.spyOn(console, "error").mockImplementation(() => {});
    jest.spyOn(Monitor, "distinct").mockRejectedValueOnce(new Error("connection reset"));
    const res = await agent.get("/api/admin/stats");
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: "Failed to load admin statistics." });
  });
});

describe("GET /api/admin/analytics", () => {
  test("returns one zero-filled UTC day per requested day", async () => {
    const { agent } = await adminAgent();
    const res = await agent.get("/api/admin/analytics?days=7");
    expect(res.status).toBe(200);
    expect(res.body.series).toHaveLength(7);
    expect(res.body.series.at(-1).date).toBe(new Date().toISOString().slice(0, 10));
    expect(res.body.series.at(-1).registrations).toBe(1);
    expect(res.body.series[0]).toMatchObject({ registrations: 0, incidentsOpened: 0, checksTotal: 0, avgResponseTime: null });
  });

  test("aggregates incidents and checks per day", async () => {
    const { agent, userId } = await adminAgent();
    const monitor = await monitorFor(userId);
    await incidentFor(monitor, { status: "resolved", resolvedAt: new Date() });
    await incidentFor(monitor);
    await checkFor(monitor, { responseTime: 50 });
    await checkFor(monitor, { success: false, responseTime: 150 });

    const today = (await agent.get("/api/admin/analytics?days=7")).body.series.at(-1);
    expect(today).toMatchObject({
      incidentsOpened: 2,
      incidentsResolved: 1,
      checksTotal: 2,
      checksSuccess: 1,
      checksFailure: 1,
      avgResponseTime: 100,
    });
  });

  test("marks days older than check retention as unavailable (null), not zero", async () => {
    const { agent } = await adminAgent();
    const res = await agent.get("/api/admin/analytics?days=90");
    expect(res.body.checkRetentionDays).toBe(30);
    expect(res.body.series[0].checksTotal).toBeNull();
    expect(res.body.series.at(-1).checksTotal).toBe(0);
  });

  test.each(["0", "8", "abc", "-7", "1e2"])("rejects days=%s with 400", async (days) => {
    const { agent } = await adminAgent();
    expect((await agent.get(`/api/admin/analytics?days=${days}`)).status).toBe(400);
  });
});

describe("GET /api/admin/users", () => {
  test("paginates newest first with totals", async () => {
    const { agent } = await adminAgent();
    await insertUsers(24);

    const first = await agent.get("/api/admin/users?limit=10");
    expect(first.body).toMatchObject({ page: 1, limit: 10, total: 25, totalPages: 3 });
    expect(first.body.users).toHaveLength(10);

    const last = await agent.get("/api/admin/users?limit=10&page=3");
    expect(last.body.users).toHaveLength(5);

    const beyond = await agent.get("/api/admin/users?limit=10&page=9");
    expect(beyond.status).toBe(200);
    expect(beyond.body.users).toEqual([]);
  });

  test("returns only safe fields, with a registration date and monitor count", async () => {
    const { agent } = await adminAgent();
    const alice = await signedInAgent();
    await monitorFor(alice.userId);
    await monitorFor(alice.userId, { name: "Second" });

    const res = await agent.get(`/api/admin/users?search=${encodeURIComponent(alice.credentials.email)}`);
    expect(res.body.users).toEqual([
      {
        id: alice.userId,
        username: alice.credentials.username,
        email: alice.credentials.email,
        role: "client",
        createdAt: expect.any(String),
        monitorCount: 2,
      },
    ]);
    expect(JSON.stringify(res.body)).not.toMatch(/password|\$2[aby]\$/);
  });

  test("searches username and email case-insensitively and filters by role", async () => {
    const { agent } = await adminAgent({ username: "root-admin" });
    await insertUsers(3, (i) => ({ username: i === 0 ? "Grace Hopper" : `user${i}`, email: i === 1 ? "grace@example.test" : `u${i}@example.test` }));

    const res = await agent.get("/api/admin/users?search=GRACE");
    expect(res.body.users.map((u) => u.username).sort()).toEqual(["Grace Hopper", "user1"]);

    const admins = await agent.get("/api/admin/users?role=admin");
    expect(admins.body.users.map((u) => u.username)).toEqual(["root-admin"]);
  });

  test("treats regex characters in the search as plain text", async () => {
    const { agent } = await adminAgent();
    await insertUsers(3);
    const res = await agent.get(`/api/admin/users?search=${encodeURIComponent(".*")}`);
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(0);
  });

  test("sorts by username", async () => {
    const { agent } = await adminAgent({ username: "mid" });
    await insertUsers(2, (i) => ({ username: i ? "zed" : "abe" }));
    const res = await agent.get("/api/admin/users?sort=username");
    expect(res.body.users.map((u) => u.username)).toEqual(["abe", "mid", "zed"]);
  });

  test("returns an empty page for no matches", async () => {
    const { agent } = await adminAgent();
    const res = await agent.get("/api/admin/users?search=nobody-matches-this");
    expect(res.body).toMatchObject({ users: [], total: 0, totalPages: 1 });
  });

  test.each([
    "page=0",
    "page=abc",
    "page=1.5",
    "limit=0",
    "limit=101",
    "role=superuser",
    "sort=password",
    "sort=-password",
    "page=1&page=2",
    `search=${"x".repeat(101)}`,
  ])("rejects %s with 400", async (query) => {
    const { agent } = await adminAgent();
    const res = await agent.get(`/api/admin/users?${query}`);
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: expect.any(String) });
  });

  test("bracket syntax can't smuggle a query operator into the search", async () => {
    const { agent } = await adminAgent();
    await insertUsers(2);
    // Express 5's query parser keeps "search[$ne]" as an unknown literal key, so no filter applies.
    const res = await agent.get("/api/admin/users?search[$ne]=x&role[$ne]=client");
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(3);
  });

  test("returns a generic 500 when the database fails", async () => {
    const { agent } = await adminAgent();
    jest.spyOn(console, "error").mockImplementation(() => {});
    jest.spyOn(User, "countDocuments").mockRejectedValueOnce(new Error("boom"));
    const res = await agent.get("/api/admin/users");
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: "Failed to list users." });
  });
});

describe("GET /api/admin/users/:id", () => {
  test("returns the user with monitors and incident counts", async () => {
    const { agent } = await adminAgent();
    const bob = await signedInAgent();
    const monitor = await monitorFor(bob.userId, { name: "Bob API" });
    await incidentFor(monitor);
    await incidentFor(monitor, { status: "resolved", resolvedAt: new Date() });

    const res = await agent.get(`/api/admin/users/${bob.userId}`);
    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({ id: bob.userId, email: bob.credentials.email, role: "client" });
    expect(res.body.monitorCount).toBe(1);
    expect(res.body.incidents).toEqual({ open: 1, resolved: 1 });
    expect(res.body.monitors[0]).toMatchObject({ name: "Bob API" });
    expect(res.body.recentIncidents).toHaveLength(2);
    expect(JSON.stringify(res.body)).not.toMatch(/password|\$2[aby]\$/);
  });

  test("returns 404 for an unknown user and 400 for a malformed ID", async () => {
    const { agent } = await adminAgent();
    expect((await agent.get(`/api/admin/users/${new mongoose.Types.ObjectId()}`)).status).toBe(404);
    for (const bad of ["123", "not-an-id", "zzzzzzzzzzzzzzzzzzzzzzzz", "aaaaaaaaaaaa"]) {
      expect((await agent.get(`/api/admin/users/${bad}`)).status).toBe(400);
    }
  });
});

describe("PATCH /api/admin/users/:id/role", () => {
  // Role changes write an audit line (ids only); keep test output quiet.
  beforeEach(() => jest.spyOn(console, "log").mockImplementation(() => {}));

  test("promotes a user, who then has admin access, and logs who did it", async () => {
    const { agent } = await adminAgent();
    const bob = await signedInAgent();

    const res = await agent.patch(`/api/admin/users/${bob.userId}/role`).send({ role: "admin" });
    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({ id: bob.userId, role: "admin" });
    expect((await bob.agent.get("/api/admin/stats")).status).toBe(200);
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining(`role of user ${bob.userId} set to "admin"`));
  });

  test("demotes another admin", async () => {
    const { agent } = await adminAgent();
    const other = await adminAgent();
    const res = await agent.patch(`/api/admin/users/${other.userId}/role`).send({ role: "client" });
    expect(res.status).toBe(200);
    expect((await other.agent.get("/api/admin/stats")).status).toBe(403);
  });

  test("refuses to change the admin's own role", async () => {
    const { agent, userId } = await adminAgent();
    const res = await agent.patch(`/api/admin/users/${userId}/role`).send({ role: "client" });
    expect(res.status).toBe(403);
    expect((await User.findById(userId).lean()).role).toBe("admin");
  });

  test.each([{}, { role: "root" }, { role: ["admin"] }, { role: { $ne: "client" } }, { role: "" }])(
    "rejects body %p with 400",
    async (body) => {
      const { agent } = await adminAgent();
      const bob = await signedInAgent();
      expect((await agent.patch(`/api/admin/users/${bob.userId}/role`).send(body)).status).toBe(400);
      expect((await User.findById(bob.userId).lean()).role).toBe("client");
    },
  );

  test("returns 404 for an unknown user and 400 for a malformed ID", async () => {
    const { agent } = await adminAgent();
    expect((await agent.patch(`/api/admin/users/${new mongoose.Types.ObjectId()}/role`).send({ role: "admin" })).status).toBe(404);
    expect((await agent.patch("/api/admin/users/nope/role").send({ role: "admin" })).status).toBe(400);
  });

  test("only changes the role, never the password hash", async () => {
    const { agent } = await adminAgent();
    const bob = await signedInAgent();
    const before = (await User.findById(bob.userId).lean()).password;
    await agent.patch(`/api/admin/users/${bob.userId}/role`).send({ role: "admin", password: "hijacked" });
    expect((await User.findById(bob.userId).lean()).password).toBe(before);
    expect((await request(app).post("/api/login").send(bob.credentials)).status).toBe(200);
  });
});

describe("GET /api/admin/monitors", () => {
  test("lists monitors across all users with their owners", async () => {
    const { agent } = await adminAgent();
    const alice = await signedInAgent();
    const bob = await signedInAgent();
    await monitorFor(alice.userId, { name: "Alice API" });
    await monitorFor(bob.userId, { name: "Bob API" });

    const res = await agent.get("/api/admin/monitors?sort=name");
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(2);
    expect(res.body.monitors.map((m) => [m.name, m.owner.email])).toEqual([
      ["Alice API", alice.credentials.email],
      ["Bob API", bob.credentials.email],
    ]);
    expect(res.body.monitors[0]).toMatchObject({ status: "unknown", lastCheckedAt: null, method: "GET" });
  });

  test("filters by status and owner, and searches name, URL and owner email", async () => {
    const { agent } = await adminAgent();
    const alice = await signedInAgent();
    const bob = await signedInAgent();
    const a = await monitorFor(alice.userId, { name: "Checkout", url: "https://shop.example.com/health" });
    await Monitor.updateOne({ _id: a._id }, { status: "down" });
    await monitorFor(bob.userId, { name: "Search", url: "https://search.example.com/" });

    expect((await agent.get("/api/admin/monitors?status=down")).body.monitors.map((m) => m.name)).toEqual(["Checkout"]);
    expect((await agent.get(`/api/admin/monitors?userId=${bob.userId}`)).body.monitors.map((m) => m.name)).toEqual(["Search"]);
    expect((await agent.get("/api/admin/monitors?search=shop.example")).body.total).toBe(1);
    const byOwner = await agent.get(`/api/admin/monitors?search=${encodeURIComponent(bob.credentials.email)}`);
    expect(byOwner.body.monitors.map((m) => m.name)).toEqual(["Search"]);
  });

  test("redacts credential-like query parameters in URLs", async () => {
    const { agent, userId } = await adminAgent();
    await monitorFor(userId, { url: "https://api.example.com/v1/ping?api_key=s3cr3t&region=eu&token=abc" });
    const [monitor] = (await agent.get("/api/admin/monitors")).body.monitors;
    expect(monitor.url).toBe("https://api.example.com/v1/ping?api_key=REDACTED&region=eu&token=REDACTED");
    expect(JSON.stringify(monitor)).not.toMatch(/s3cr3t|abc/);
  });

  test("shows monitors whose owner was deleted with owner null", async () => {
    const { agent } = await adminAgent();
    await monitorFor(new mongoose.Types.ObjectId());
    const [monitor] = (await agent.get("/api/admin/monitors")).body.monitors;
    expect(monitor.owner).toBeNull();
  });

  test.each(["status=sideways", "sort=url", "userId=bad", "limit=500"])("rejects %s with 400", async (query) => {
    const { agent } = await adminAgent();
    expect((await agent.get(`/api/admin/monitors?${query}`)).status).toBe(400);
  });

  test("returns a generic 500 when the database fails", async () => {
    const { agent } = await adminAgent();
    jest.spyOn(console, "error").mockImplementation(() => {});
    jest.spyOn(Monitor, "countDocuments").mockRejectedValueOnce(new Error("boom"));
    const res = await agent.get("/api/admin/monitors");
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: "Failed to list monitors." });
  });
});

describe("GET /api/admin/monitors/:id", () => {
  test("returns the monitor with its latest checks, 24h summary and incidents", async () => {
    const { agent } = await adminAgent();
    const bob = await signedInAgent();
    const monitor = await monitorFor(bob.userId);
    await checkFor(monitor, { responseTime: 80, checkedAt: minutesAgo(2) });
    await checkFor(monitor, { success: false, statusCode: 500, responseTime: 120, checkedAt: minutesAgo(1) });
    await incidentFor(monitor);

    const res = await agent.get(`/api/admin/monitors/${monitor._id}`);
    expect(res.status).toBe(200);
    expect(res.body.monitor).toMatchObject({ id: String(monitor._id), owner: { id: bob.userId } });
    expect(res.body.checksLast24h).toEqual({ total: 2, success: 1, failure: 1, avgResponseTime: 100 });
    expect(res.body.recentChecks.map((c) => c.statusCode)).toEqual([500, 200]);
    expect(res.body.recentIncidents).toHaveLength(1);
  });

  test("returns 404 for an unknown monitor and 400 for a malformed ID", async () => {
    const { agent } = await adminAgent();
    expect((await agent.get(`/api/admin/monitors/${new mongoose.Types.ObjectId()}`)).status).toBe(404);
    expect((await agent.get("/api/admin/monitors/xyz")).status).toBe(400);
  });
});

describe("GET /api/admin/incidents", () => {
  test("lists incidents from all users, newest first, with monitor and owner", async () => {
    const { agent } = await adminAgent();
    const alice = await signedInAgent();
    const bob = await signedInAgent();
    const a = await monitorFor(alice.userId, { name: "Alice API" });
    const b = await monitorFor(bob.userId, { name: "Bob API" });
    await incidentFor(a, { reason: "older", startedAt: minutesAgo(60), status: "resolved", resolvedAt: minutesAgo(10) });
    await incidentFor(b, { reason: "newer", startedAt: minutesAgo(5) });

    const res = await agent.get("/api/admin/incidents");
    expect(res.body.total).toBe(2);
    expect(res.body.incidents[0]).toMatchObject({
      reason: "newer",
      status: "open",
      resolvedAt: null,
      monitor: { name: "Bob API" },
      owner: { id: bob.userId },
    });
    expect(res.body.incidents[1]).toMatchObject({ reason: "older", status: "resolved", resolvedAt: expect.any(String) });
  });

  test("filters by status and monitor, searches reason and monitor name, paginates", async () => {
    const { agent, userId } = await adminAgent();
    const api = await monitorFor(userId, { name: "Payments" });
    const web = await monitorFor(userId, { name: "Website" });
    for (let i = 0; i < 3; i += 1) await incidentFor(api, { reason: `timeout ${i}`, startedAt: minutesAgo(i + 1) });
    await incidentFor(web, { reason: "DNS lookup failed", status: "resolved", resolvedAt: new Date() });

    expect((await agent.get("/api/admin/incidents?status=resolved")).body.total).toBe(1);
    expect((await agent.get(`/api/admin/incidents?monitorId=${web._id}`)).body.total).toBe(1);
    expect((await agent.get("/api/admin/incidents?search=dns")).body.total).toBe(1);
    expect((await agent.get("/api/admin/incidents?search=payments")).body.total).toBe(3);
    const page2 = await agent.get("/api/admin/incidents?limit=2&page=2");
    expect(page2.body).toMatchObject({ total: 4, totalPages: 2 });
    expect(page2.body.incidents).toHaveLength(2);
  });

  test("returns an empty list when there are no incidents", async () => {
    const { agent } = await adminAgent();
    expect((await agent.get("/api/admin/incidents")).body).toMatchObject({ incidents: [], total: 0 });
  });

  test.each(["status=closed", "monitorId=123", "userId=zz", "sort=reason"])("rejects %s with 400", async (query) => {
    const { agent } = await adminAgent();
    expect((await agent.get(`/api/admin/incidents?${query}`)).status).toBe(400);
  });

  test("returns a generic 500 when the database fails", async () => {
    const { agent } = await adminAgent();
    jest.spyOn(console, "error").mockImplementation(() => {});
    jest.spyOn(Incident, "countDocuments").mockRejectedValueOnce(new Error("boom"));
    const res = await agent.get("/api/admin/incidents");
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: "Failed to list incidents." });
  });
});

describe("system health and settings", () => {
  test("health reports the database, scheduler and check activity", async () => {
    const { agent, userId } = await adminAgent();
    const fresh = await monitorFor(userId);
    await Monitor.updateOne({ _id: fresh._id }, { lastCheckedAt: new Date() });
    await monitorFor(userId, { name: "never checked" });
    await checkFor(fresh);

    const res = await agent.get("/api/admin/health");
    expect(res.body.database).toMatchObject({ state: "connected", pingMs: expect.any(Number) });
    expect(res.body.scheduler).toMatchObject({
      running: false, // tests never start the scheduler
      checksLastHour: 1,
      overdueMonitors: 1,
      totalMonitors: 2,
      lastCheckAt: expect.any(String),
    });
  });

  test("settings expose configuration but never the JWT secret", async () => {
    const { agent } = await adminAgent();
    const res = await agent.get("/api/admin/settings");
    expect(res.body.settings).toMatchObject({ sessionTtlSeconds: 86400, checkRetentionDays: 30, cookieSameSite: "lax" });
    expect(JSON.stringify(res.body)).not.toContain(process.env.JWT_SECRET);
    expect(JSON.stringify(res.body).toLowerCase()).not.toContain("secret\"");
  });
});
