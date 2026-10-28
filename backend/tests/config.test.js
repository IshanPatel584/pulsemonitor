const { spawnSync } = require("node:child_process");
const path = require("node:path");
const { loadAuthConfig, DEFAULT_TTL_SECONDS } = require("../config/auth");

const STRONG = "s".repeat(48);

describe("loadAuthConfig", () => {
  test("throws when JWT_SECRET is missing or empty", () => {
    expect(() => loadAuthConfig({})).toThrow(/JWT_SECRET is not set/);
    expect(() => loadAuthConfig({ JWT_SECRET: "" })).toThrow(/JWT_SECRET is not set/);
  });

  test("throws when JWT_SECRET is shorter than 32 characters, without echoing it", () => {
    const weak = "ishan";
    let error;
    try {
      loadAuthConfig({ JWT_SECRET: weak });
    } catch (err) {
      error = err;
    }
    expect(error).toBeDefined();
    expect(error.code).toBe("EAUTHCONFIG");
    expect(error.message).toMatch(/at least 32 characters/);
    expect(error.message).not.toContain(weak);
  });

  test("has no fallback secret in production", () => {
    expect(() => loadAuthConfig({ NODE_ENV: "production" })).toThrow(/JWT_SECRET is not set/);
  });

  test("defaults: 1 day lifetime, HS256, httpOnly + SameSite=Lax, not Secure outside production", () => {
    const config = loadAuthConfig({ JWT_SECRET: STRONG });
    expect(config).toMatchObject({
      ttlSeconds: DEFAULT_TTL_SECONDS,
      cookieMaxAgeMs: DEFAULT_TTL_SECONDS * 1000,
      algorithm: "HS256",
      cookieName: "jwt",
      cookie: { httpOnly: true, sameSite: "lax", secure: false, path: "/" },
    });
  });

  test("cookies are always Secure in production", () => {
    expect(loadAuthConfig({ JWT_SECRET: STRONG, NODE_ENV: "production" }).cookie.secure).toBe(true);
    expect(loadAuthConfig({ JWT_SECRET: STRONG, NODE_ENV: "production", COOKIE_SECURE: "false" }).cookie.secure).toBe(true);
  });

  test("COOKIE_SECURE=true forces Secure outside production; SameSite=None always implies Secure", () => {
    expect(loadAuthConfig({ JWT_SECRET: STRONG, COOKIE_SECURE: "true" }).cookie.secure).toBe(true);
    expect(loadAuthConfig({ JWT_SECRET: STRONG, COOKIE_SAME_SITE: "none" }).cookie).toMatchObject({ sameSite: "none", secure: true });
  });

  test.each([["0"], ["-60"], ["1.5"], ["a day"]])("rejects JWT_TTL_SECONDS=%s", (value) => {
    expect(() => loadAuthConfig({ JWT_SECRET: STRONG, JWT_TTL_SECONDS: value })).toThrow(/JWT_TTL_SECONDS/);
  });

  test("rejects an unknown COOKIE_SAME_SITE value", () => {
    expect(() => loadAuthConfig({ JWT_SECRET: STRONG, COOKIE_SAME_SITE: "sometimes" })).toThrow(/COOKIE_SAME_SITE/);
  });
});

describe("server startup", () => {
  // Runs the real entry point. Explicit empty/short values take precedence over
  // backend/.env (dotenv never overrides existing variables), and the process
  // must exit before it connects to MongoDB or opens a port.
  const start = (env) =>
    spawnSync(process.execPath, ["app.js"], {
      cwd: path.join(__dirname, ".."),
      env: { ...process.env, NODE_ENV: "production", ...env },
      encoding: "utf8",
      timeout: 15000,
    });

  test("exits with an error when JWT_SECRET is missing", () => {
    const result = start({ JWT_SECRET: "" });
    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/\[config\] JWT_SECRET is not set/);
    expect(result.stdout).not.toMatch(/MongoDB connected|listening/);
  });

  test("exits with an error when JWT_SECRET is too short, without printing it", () => {
    const weak = "short-secret-value";
    const result = start({ JWT_SECRET: weak });
    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/at least 32 characters/);
    expect(`${result.stdout}${result.stderr}`).not.toContain(weak);
  });
});
