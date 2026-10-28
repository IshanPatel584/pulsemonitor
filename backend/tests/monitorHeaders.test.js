jest.mock("../monitoring/httpCheck", () => ({ performCheck: jest.fn() }));

const User = require("../models/User");
const Monitor = require("../models/Monitor");
const CheckResult = require("../models/CheckResult");
const { performCheck } = require("../monitoring/httpCheck");
const { runCheck } = require("../monitoring/scheduler");
const { connectTestDb, clearTestDb, closeTestDb } = require("./helpers/db");
const { signedInAgent, validMonitor } = require("./helpers/auth");

beforeAll(connectTestDb);
afterEach(clearTestDb);
afterAll(closeTestDb);

// Throwaway values that must never appear anywhere outside the request itself.
const TOKEN = "Bearer test-token-6f1c2a9e";
const API_KEY = "test-key-93b7d1c4";

const withHeaders = (headers, overrides) => ({ ...validMonitor(overrides), headers });
const stored = (id) => Monitor.findById(id).lean();
const leaks = (body) => {
  const text = JSON.stringify(body);
  return text.includes(TOKEN) || text.includes(API_KEY) || text.includes("v1:");
};

async function createWithHeaders(agent, headers = [{ name: "Authorization", value: TOKEN }, { name: "X-API-Key", value: API_KEY }], overrides) {
  const res = await agent.post("/api/monitor").send(withHeaders(headers, overrides));
  expect(res.status).toBe(200);
  return res.body.monitor;
}

describe("creating a monitor with headers", () => {
  test("stores the values encrypted and returns only the names", async () => {
    const { agent } = await signedInAgent();
    const id = await createWithHeaders(agent);

    const doc = await stored(id);
    expect(doc.headers.map((h) => h.name)).toEqual(["Authorization", "X-API-Key"]);
    for (const h of doc.headers) {
      expect(h.value).toMatch(/^v1:/);
      expect(h.value).not.toContain("test-");
    }

    const list = await agent.get("/api/monitor");
    expect(list.body.monitors[0].headers).toEqual([
      { name: "Authorization", configured: true },
      { name: "X-API-Key", configured: true },
    ]);
    expect(leaks(list.body)).toBe(false);
    const one = await agent.get(`/api/monitors/${id}`);
    expect(leaks(one.body)).toBe(false);
  });

  test("monitors without headers keep working as before", async () => {
    const { agent } = await signedInAgent();
    const res = await agent.post("/api/monitor").send(validMonitor());
    expect(res.status).toBe(200);
    expect((await stored(res.body.monitor)).headers).toEqual([]);
    expect((await agent.get("/api/monitor")).body.monitors[0].headers).toEqual([]);
  });

  test.each([
    ["not a list", "Authorization: x"],
    ["missing value", [{ name: "Authorization" }]],
    ["empty value", [{ name: "Authorization", value: "" }]],
    ["non-string value", [{ name: "Authorization", value: { $ne: null } }]],
    ["CRLF injection", [{ name: "X-API-Key", value: "abc\r\nHost: evil.example" }]],
    ["newline", [{ name: "X-API-Key", value: "abc\ndef" }]],
    ["invalid name", [{ name: "Bad Header", value: "x" }]],
    ["name with colon", [{ name: "X-Key:", value: "x" }]],
    ["Host", [{ name: "Host", value: "internal.example" }]],
    ["Content-Length", [{ name: "content-length", value: "5" }]],
    ["Transfer-Encoding", [{ name: "Transfer-Encoding", value: "chunked" }]],
    ["Proxy-Authorization", [{ name: "Proxy-Authorization", value: "x" }]],
    ["X-Forwarded-For", [{ name: "X-Forwarded-For", value: "10.0.0.1" }]],
    ["duplicate (case-insensitive)", [{ name: "X-API-Key", value: "a" }, { name: "x-api-key", value: "b" }]],
    ["too long", [{ name: "X-API-Key", value: "x".repeat(4097) }]],
    ["too many", Array.from({ length: 11 }, (_, i) => ({ name: `X-H${i}`, value: "v" }))],
  ])("rejects %s with 400 and creates nothing", async (_label, headers) => {
    const { agent } = await signedInAgent();
    const res = await agent.post("/api/monitor").send(withHeaders(headers));
    expect(res.status).toBe(400);
    expect(res.body.errors.headers).toEqual(expect.any(String));
    expect(JSON.stringify(res.body)).not.toContain("evil.example");
    expect(await Monitor.countDocuments()).toBe(0);
  });

  test("explains that headers are disabled when the server has no encryption key", async () => {
    const { agent } = await signedInAgent();
    const key = process.env.MONITOR_CREDENTIALS_KEY;
    delete process.env.MONITOR_CREDENTIALS_KEY;
    try {
      const res = await agent.post("/api/monitor").send(withHeaders([{ name: "X-API-Key", value: API_KEY }]));
      expect(res.status).toBe(400);
      expect(res.body.errors.headers).toMatch(/MONITOR_CREDENTIALS_KEY/);
      // Monitors without headers don't need the key.
      expect((await agent.post("/api/monitor").send(validMonitor())).status).toBe(200);
    } finally {
      process.env.MONITOR_CREDENTIALS_KEY = key;
    }
  });

  test("the SSRF rules still apply to monitors with headers", async () => {
    const { agent } = await signedInAgent();
    const res = await agent.post("/api/monitor").send(withHeaders([{ name: "X-API-Key", value: API_KEY }], { url: "http://169.254.169.254/latest/" }));
    expect(res.status).toBe(400);
    expect(await Monitor.countDocuments()).toBe(0);
  });
});

describe("updating headers", () => {
  test("a header sent without a value keeps its saved value; omitted headers are removed", async () => {
    const { agent } = await signedInAgent();
    const id = await createWithHeaders(agent);
    const before = await stored(id);

    const res = await agent.patch(`/api/monitors/${id}`).send({ headers: [{ name: "Authorization" }] });
    expect(res.status).toBe(200);
    expect(res.body.monitor.headers).toEqual([{ name: "Authorization", configured: true }]);
    expect(leaks(res.body)).toBe(false);

    const after = await stored(id);
    expect(after.headers).toEqual([before.headers[0]]);
  });

  test("a new value replaces the saved one", async () => {
    const { agent } = await signedInAgent();
    const id = await createWithHeaders(agent);
    const before = await stored(id);
    await agent.patch(`/api/monitors/${id}`).send({ headers: [{ name: "Authorization", value: "Bearer rotated" }, { name: "X-API-Key" }] });
    const after = await stored(id);
    expect(after.headers[0].value).not.toBe(before.headers[0].value);
    expect(after.headers[1].value).toBe(before.headers[1].value);
  });

  test("an empty list removes all headers, and leaving headers out changes nothing", async () => {
    const { agent } = await signedInAgent();
    const id = await createWithHeaders(agent);
    const before = await stored(id);

    await agent.patch(`/api/monitors/${id}`).send({ name: "Renamed" });
    expect((await stored(id)).headers).toEqual(before.headers);

    await agent.patch(`/api/monitors/${id}`).send({ headers: [] });
    expect((await stored(id)).headers).toEqual([]);
  });

  test("a value for a header that was never saved is required", async () => {
    const { agent } = await signedInAgent();
    const id = await createWithHeaders(agent);
    const res = await agent.patch(`/api/monitors/${id}`).send({ headers: [{ name: "X-New" }] });
    expect(res.status).toBe(400);
    expect(res.body.errors.headers).toMatch(/Enter a value/);
  });

  test("saved values are never sent to a new host: changing the origin requires re-entering them", async () => {
    const { agent } = await signedInAgent();
    const id = await createWithHeaders(agent);
    const before = await stored(id);

    const moved = await agent.patch(`/api/monitors/${id}`).send({ url: "https://other.example.net/health" });
    expect(moved.status).toBe(400);
    expect(moved.body.errors.headers).toMatch(/Re-enter/);
    expect(await stored(id)).toMatchObject({ url: before.url, headers: before.headers });

    const keptAcrossHosts = await agent
      .patch(`/api/monitors/${id}`)
      .send({ url: "https://other.example.net/health", headers: [{ name: "Authorization", value: "Bearer new" }, { name: "X-API-Key" }] });
    expect(keptAcrossHosts.status).toBe(400);

    const reentered = await agent
      .patch(`/api/monitors/${id}`)
      .send({ url: "https://other.example.net/health", headers: [{ name: "Authorization", value: "Bearer new" }] });
    expect(reentered.status).toBe(200);
    expect((await stored(id)).url).toBe("https://other.example.net/health");
  });

  test("changing only the path on the same host keeps the saved values", async () => {
    const { agent } = await signedInAgent();
    const id = await createWithHeaders(agent);
    const before = await stored(id);
    const res = await agent.patch(`/api/monitors/${id}`).send({ url: "https://example.com/v2/health" });
    expect(res.status).toBe(200);
    expect((await stored(id)).headers).toEqual(before.headers);
  });

  test("validation errors on update leave the saved headers untouched", async () => {
    const { agent } = await signedInAgent();
    const id = await createWithHeaders(agent);
    const before = await stored(id);
    const res = await agent.patch(`/api/monitors/${id}`).send({ headers: [{ name: "Host", value: "x" }] });
    expect(res.status).toBe(400);
    expect((await stored(id)).headers).toEqual(before.headers);
  });
});

describe("ownership", () => {
  test("another user can't read, change, or remove a monitor's headers", async () => {
    const owner = await signedInAgent();
    const intruder = await signedInAgent();
    const id = await createWithHeaders(owner.agent);
    const before = await stored(id);

    expect((await intruder.agent.get(`/api/monitors/${id}`)).status).toBe(404);
    expect((await intruder.agent.patch(`/api/monitors/${id}`).send({ headers: [] })).status).toBe(404);
    expect(
      (await intruder.agent.patch(`/api/monitors/${id}`).send({ headers: [{ name: "Authorization", value: "Bearer stolen" }] })).status,
    ).toBe(404);
    expect((await intruder.agent.delete(`/api/monitors/${id}`)).status).toBe(404);
    expect(leaks((await intruder.agent.get("/api/monitor")).body)).toBe(false);
    expect((await stored(id)).headers).toEqual(before.headers);
  });

  test("deleting the monitor deletes its stored headers", async () => {
    const { agent } = await signedInAgent();
    const id = await createWithHeaders(agent);
    expect((await agent.delete(`/api/monitors/${id}`)).status).toBe(200);
    expect(await stored(id)).toBeNull();
  });

  test("admin views never include header values", async () => {
    const owner = await signedInAgent();
    const id = await createWithHeaders(owner.agent);
    const admin = await signedInAgent();
    await User.updateOne({ _id: admin.userId }, { role: "admin" });

    for (const path of ["/api/admin/monitors", `/api/admin/monitors/${id}`, `/api/admin/users/${owner.userId}`]) {
      const res = await admin.agent.get(path);
      expect(res.status).toBe(200);
      expect(leaks(res.body)).toBe(false);
    }
  });
});

describe("scheduled checks", () => {
  const ok = { checkedAt: new Date(), statusCode: 200, responseTime: 50, error: null };

  test("send the decrypted headers to performCheck for the monitor's own URL", async () => {
    const { agent } = await signedInAgent();
    const id = await createWithHeaders(agent);
    performCheck.mockResolvedValueOnce(ok);

    await runCheck(await stored(id));

    expect(performCheck).toHaveBeenCalledTimes(1);
    const [arg] = performCheck.mock.calls[0];
    expect(arg).toMatchObject({ url: "https://example.com/health", method: "GET" });
    expect(arg.headers).toEqual({ authorization: TOKEN, "x-api-key": API_KEY });
  });

  test("monitors without headers are checked with none", async () => {
    const { agent } = await signedInAgent();
    const res = await agent.post("/api/monitor").send(validMonitor());
    performCheck.mockResolvedValueOnce(ok);
    await runCheck(await stored(res.body.monitor));
    expect(performCheck.mock.calls[0][0].headers).toEqual({});
  });

  test("if the key changed, the check fails without sending the request or leaking values", async () => {
    const { agent } = await signedInAgent();
    const id = await createWithHeaders(agent);
    const key = process.env.MONITOR_CREDENTIALS_KEY;
    process.env.MONITOR_CREDENTIALS_KEY = require("node:crypto").randomBytes(32).toString("base64");
    try {
      await runCheck(await stored(id));
    } finally {
      process.env.MONITOR_CREDENTIALS_KEY = key;
    }

    expect(performCheck).not.toHaveBeenCalled();
    const check = await CheckResult.findOne({ monitorId: id }).lean();
    expect(check).toMatchObject({ success: false, statusCode: null, error: expect.stringMatching(/can't be decrypted/) });
    expect(check.error).not.toContain("test-");
    expect((await stored(id)).status).toBe("down");
  });

  test("a stored value copied to another monitor doesn't decrypt there", async () => {
    const { agent, userId } = await signedInAgent();
    const source = await stored(await createWithHeaders(agent));
    const copy = await Monitor.create({ userId, ...validMonitor({ name: "Copy" }), headers: source.headers });

    await runCheck(await stored(copy._id));

    expect(performCheck).not.toHaveBeenCalled();
    expect((await CheckResult.findOne({ monitorId: copy._id }).lean()).error).toMatch(/can't be decrypted/);
  });

  test("header values never appear in console output", async () => {
    const spies = ["log", "warn", "error", "info"].map((m) => jest.spyOn(console, m).mockImplementation(() => {}));
    const { agent } = await signedInAgent();
    const id = await createWithHeaders(agent);
    performCheck.mockRejectedValueOnce(new Error("network exploded"));
    await runCheck(await stored(id));
    const output = JSON.stringify(spies.flatMap((s) => s.mock.calls));
    expect(output).not.toContain(TOKEN);
    expect(output).not.toContain(API_KEY);
  });
});
