const dns = require("node:dns");
const https = require("node:https");
const http = require("node:http");
const { EventEmitter } = require("node:events");
const { performCheck } = require("../monitoring/httpCheck");
const { safeLookup } = require("../monitoring/ssrf");

// No request leaves the process: http(s).request and dns.lookup are replaced
// with fakes, so these tests exercise the check logic and the SSRF guards only.

function fakeRequest(statusCode = 200) {
  const calls = [];
  const spy = (target, options, onResponse) => {
    const req = new EventEmitter();
    req.end = () => {
      const res = new EventEmitter();
      res.statusCode = statusCode;
      res.destroy = () => {};
      setImmediate(() => onResponse(res));
    };
    req.destroy = (err) => err && setImmediate(() => req.emit("error", err));
    calls.push({ target: String(target), options });
    return req;
  };
  return { calls, spy };
}

describe("performCheck", () => {
  test("blocks private targets before any connection is attempted", async () => {
    const request = jest.spyOn(http, "request");
    for (const url of ["http://127.0.0.1/", "http://169.254.169.254/latest/meta-data/", "http://localhost:5000/"]) {
      const result = await performCheck({ url, method: "GET" });
      expect(result).toMatchObject({ statusCode: null, responseTime: null, error: expect.stringMatching(/^Blocked:/) });
    }
    expect(request).not.toHaveBeenCalled();
  });

  test("sends the monitor's method to its URL and reports the status code", async () => {
    const fake = fakeRequest(204);
    jest.spyOn(https, "request").mockImplementation(fake.spy);

    const result = await performCheck({ url: "https://example.com/health", method: "DELETE" });

    expect(result).toMatchObject({ statusCode: 204, error: null, responseTime: expect.any(Number) });
    expect(fake.calls).toHaveLength(1);
    expect(fake.calls[0].target).toBe("https://example.com/health");
    expect(fake.calls[0].options).toMatchObject({ method: "DELETE", lookup: safeLookup });
    expect(fake.calls[0].options.headers["content-length"]).toBeUndefined();
  });

  test("always connects through the SSRF-checking DNS lookup", async () => {
    const fake = fakeRequest();
    jest.spyOn(https, "request").mockImplementation(fake.spy);
    await performCheck({ url: "https://example.com/", method: "POST" });
    expect(fake.calls[0].options.lookup).toBe(safeLookup);
    expect(fake.calls[0].options.headers["content-length"]).toBe("0");
  });

  test("reports a blocked DNS answer as a failed check", async () => {
    jest.spyOn(https, "request").mockImplementation((target, options) => {
      const req = new EventEmitter();
      req.end = () => {
        const err = new Error("example.com resolves to a private or reserved address");
        err.code = "EBLOCKED";
        setImmediate(() => req.emit("error", err));
      };
      req.destroy = () => {};
      return req;
    });
    const result = await performCheck({ url: "https://example.com/", method: "GET" });
    expect(result).toMatchObject({ statusCode: null, error: "Blocked: example.com resolves to a private or reserved address" });
  });
});

describe("safeLookup (check-time SSRF guard)", () => {
  const lookupResult = (addresses) =>
    jest.spyOn(dns, "lookup").mockImplementation((host, options, callback) => callback(null, addresses));

  const run = (options = {}) => new Promise((resolve) => safeLookup("example.com", options, (...args) => resolve(args)));

  test("passes public addresses through", async () => {
    lookupResult([{ address: "93.184.216.34", family: 4 }]);
    const [err, address, family] = await run();
    expect(err).toBeNull();
    expect([address, family]).toEqual(["93.184.216.34", 4]);
  });

  test.each([["127.0.0.1"], ["10.1.2.3"], ["169.254.169.254"], ["::1"]])("blocks a hostname resolving to %s", async (ip) => {
    lookupResult([{ address: ip, family: ip.includes(":") ? 6 : 4 }]);
    const [err] = await run();
    expect(err).toMatchObject({ code: "EBLOCKED" });
  });

  test("blocks when any one of several addresses is private (DNS rebinding)", async () => {
    lookupResult([
      { address: "93.184.216.34", family: 4 },
      { address: "192.168.0.10", family: 4 },
    ]);
    const [err] = await run({ all: true });
    expect(err).toMatchObject({ code: "EBLOCKED" });
  });

  test("blocks an empty DNS answer", async () => {
    lookupResult([]);
    const [err] = await run();
    expect(err).toMatchObject({ code: "EBLOCKED" });
  });
});

describe("performCheck with custom headers", () => {
  test("adds the monitor's headers to the request but never lets them set Content-Length", async () => {
    const fake = fakeRequest();
    jest.spyOn(https, "request").mockImplementation(fake.spy);

    await performCheck({
      url: "https://api.example.com/v1/ping",
      method: "POST",
      headers: { authorization: "Bearer t", "x-api-key": "k", "content-length": "99" },
    });

    expect(fake.calls).toHaveLength(1);
    expect(fake.calls[0].target).toBe("https://api.example.com/v1/ping");
    expect(fake.calls[0].options.headers).toMatchObject({ authorization: "Bearer t", "x-api-key": "k", "content-length": "0" });
  });

  test("never sends headers to a blocked target", async () => {
    const request = jest.spyOn(http, "request");
    const result = await performCheck({ url: "http://10.0.0.1/", method: "GET", headers: { authorization: "Bearer t" } });
    expect(result.error).toMatch(/^Blocked:/);
    expect(request).not.toHaveBeenCalled();
  });
});

describe("loadCredentialsKey", () => {
  const { loadCredentialsKey } = require("../monitoring/credentials");

  test("accepts 32-byte base64 and hex keys and returns null when unset", () => {
    expect(loadCredentialsKey({})).toBeNull();
    expect(loadCredentialsKey({ MONITOR_CREDENTIALS_KEY: Buffer.alloc(32, 1).toString("base64") })).toHaveLength(32);
    expect(loadCredentialsKey({ MONITOR_CREDENTIALS_KEY: "ab".repeat(32) })).toHaveLength(32);
  });

  test("rejects a malformed key without echoing it", () => {
    const value = "too-short-secret-value";
    expect(() => loadCredentialsKey({ MONITOR_CREDENTIALS_KEY: value })).toThrow(/32 bytes/);
    try {
      loadCredentialsKey({ MONITOR_CREDENTIALS_KEY: value });
    } catch (err) {
      expect(err.message).not.toContain(value);
    }
  });
});
