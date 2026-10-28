const jwt = require("jsonwebtoken");
const User = require("../models/User");
const { connectTestDb, clearTestDb, closeTestDb } = require("./helpers/db");
const { app, request, testCredentials, signedInAgent } = require("./helpers/auth");

beforeAll(connectTestDb);
afterEach(clearTestDb);
afterAll(closeTestDb);

const jwtCookie = (res) => (res.headers["set-cookie"] ?? []).find((c) => c.startsWith("jwt="));

describe("POST /api/signup", () => {
  test("creates a user with valid data and sets an httpOnly jwt cookie", async () => {
    const creds = testCredentials();
    const res = await request(app).post("/api/signup").send(creds);

    expect(res.status).toBe(200);
    expect(res.body.user).toMatch(/^[a-f0-9]{24}$/);
    expect(jwtCookie(res)).toMatch(/HttpOnly/i);

    const user = await User.findById(res.body.user).lean();
    expect(user.email).toBe(creds.email.toLowerCase());
    expect(user.password).not.toBe(creds.password); // stored hashed
  });

  test("rejects a duplicate email", async () => {
    const creds = testCredentials();
    await request(app).post("/api/signup").send(creds).expect(200);

    const res = await request(app)
      .post("/api/signup")
      .send({ ...creds, username: "someone-else", email: creds.email.toUpperCase() });

    expect(res.status).toBe(400);
    expect(res.body.errors.email).toBe("this email already exist");
    expect(await User.countDocuments({ email: creds.email.toLowerCase() })).toBe(1);
  });

  test("rejects missing fields with a message per field", async () => {
    const res = await request(app).post("/api/signup").send({});

    expect(res.status).toBe(400);
    expect(res.body.errors).toMatchObject({
      username: "Please enter your Username",
      email: "Please enter your Email",
      password: "Please enter your Password",
    });
    expect(jwtCookie(res)).toBeUndefined();
  });

  test("rejects a password shorter than 6 characters", async () => {
    const res = await request(app).post("/api/signup").send(testCredentials({ password: "12345" }));

    expect(res.status).toBe(400);
    expect(res.body.errors.password).toBe("Minimum password length should be 6");
  });

  test("rejects a malformed email address", async () => {
    const res = await request(app).post("/api/signup").send(testCredentials({ email: "not-an-email" }));

    expect(res.status).toBe(400);
    expect(res.body.errors.email).toBe("Please enter a valid Email");
    expect(await User.countDocuments()).toBe(0);
  });

  test("rejects non-string fields with 400 instead of crashing", async () => {
    const res = await request(app).post("/api/signup").send({ ...testCredentials(), username: { nested: true } });

    expect(res.status).toBe(400);
    expect(res.body.errors.username).toEqual(expect.any(String));
    expect(await User.countDocuments()).toBe(0);
  });

  test("ignores a role supplied in the request body", async () => {
    const res = await request(app).post("/api/signup").send({ ...testCredentials(), role: "admin" });

    expect(res.status).toBe(200);
    const user = await User.findById(res.body.user).lean();
    expect(user.role).toBe("client");
  });
});

describe("POST /api/login", () => {
  test("logs in with valid credentials and sets a jwt cookie", async () => {
    const creds = testCredentials();
    await request(app).post("/api/signup").send(creds).expect(200);

    const res = await request(app).post("/api/login").send({ email: creds.email, password: creds.password });

    expect(res.status).toBe(200);
    expect(res.body.user).toMatch(/^[a-f0-9]{24}$/);
    expect(jwtCookie(res)).toBeDefined();
  });

  test("rejects a wrong password", async () => {
    const creds = testCredentials();
    await request(app).post("/api/signup").send(creds).expect(200);

    const res = await request(app).post("/api/login").send({ email: creds.email, password: "wrong-password" });

    expect(res.status).toBe(400);
    expect(res.body.errors.password).toBe("this password is incorrect");
    expect(jwtCookie(res)).toBeUndefined();
  });

  test("rejects an unknown email", async () => {
    const res = await request(app).post("/api/login").send({ email: "nobody@example.test", password: "whatever1" });

    expect(res.status).toBe(400);
    expect(res.body.errors.email).toBe("this email is not register");
  });

  test("rejects query operators in place of an email (NoSQL injection)", async () => {
    const creds = testCredentials();
    await request(app).post("/api/signup").send(creds).expect(200);

    // Without type checks, { $ne: null } matches the first user in the collection.
    const res = await request(app).post("/api/login").send({ email: { $ne: null }, password: creds.password });

    expect(res.status).toBe(400);
    expect(jwtCookie(res)).toBeUndefined();
  });
});

describe("authentication on protected routes", () => {
  const protectedRoutes = [
    ["get", "/api/monitor"],
    ["post", "/api/monitor"],
    ["patch", "/api/monitors/507f1f77bcf86cd799439011"],
    ["delete", "/api/monitors/507f1f77bcf86cd799439011"],
    ["get", "/api/monitors/507f1f77bcf86cd799439011/history"],
    ["get", "/api/incidents"],
  ];

  test.each(protectedRoutes)("%s %s returns 401 without a session", async (method, path) => {
    const res = await request(app)[method](path).send({});
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: "Please log in to continue." });
  });

  test("returns 401 for a token signed with a different secret", async () => {
    const { userId } = await signedInAgent();
    const forged = jwt.sign({ id: userId }, "not-the-server-secret");

    const res = await request(app).get("/api/monitor").set("Cookie", `jwt=${forged}`);
    expect(res.status).toBe(401);
  });

  test("returns 401 for a valid token whose user no longer exists", async () => {
    const { agent, userId } = await signedInAgent();
    await User.deleteOne({ _id: userId });

    const res = await agent.get("/api/monitor");
    expect(res.status).toBe(401);
  });

  test("logout clears the session cookie", async () => {
    const { agent } = await signedInAgent();
    await agent.get("/api/monitor").expect(200);

    const res = await agent.post("/api/logout");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true });

    await agent.get("/api/monitor").expect(401);
  });
});

// ---- Token and cookie hardening ------------------------------------------------

const SECRET = () => process.env.JWT_SECRET; // random per run (tests/setup-env.js), never printed

/** Parses one Set-Cookie header into { value, attrs } with lower-cased attribute names. */
function parseCookie(header) {
  const [pair, ...parts] = header.split(";").map((s) => s.trim());
  const attrs = {};
  for (const part of parts) {
    const [k, ...v] = part.split("=");
    attrs[k.toLowerCase()] = v.length ? v.join("=") : true;
  }
  return { value: pair.slice(pair.indexOf("=") + 1), attrs };
}

describe("session token", () => {
  test("is an HS256 JWT that expires after JWT_TTL_SECONDS (default 1 day)", async () => {
    const creds = testCredentials();
    const res = await request(app).post("/api/signup").send(creds);
    const { value } = parseCookie(jwtCookie(res));

    const decoded = jwt.verify(value, SECRET(), { algorithms: ["HS256"], complete: true });
    expect(decoded.header.alg).toBe("HS256");
    expect(decoded.payload.id).toBe(res.body.user);
    expect(decoded.payload.exp - decoded.payload.iat).toBe(24 * 60 * 60);
  });

  test("respects a custom JWT_TTL_SECONDS", async () => {
    process.env.JWT_TTL_SECONDS = "600";
    try {
      const res = await request(app).post("/api/signup").send(testCredentials());
      const { value, attrs } = parseCookie(jwtCookie(res));
      const payload = jwt.decode(value);
      expect(payload.exp - payload.iat).toBe(600);
      expect(attrs["max-age"]).toBe("600");
    } finally {
      delete process.env.JWT_TTL_SECONDS;
    }
  });

  test("an expired token is rejected with 401 and its cookie is cleared", async () => {
    const { userId } = await signedInAgent();
    const expired = jwt.sign({ id: userId, exp: Math.floor(Date.now() / 1000) - 60 }, SECRET(), { algorithm: "HS256" });

    const res = await request(app).get("/api/monitor").set("Cookie", `jwt=${expired}`);

    expect(res.status).toBe(401);
    const cleared = parseCookie(jwtCookie(res));
    expect(cleared.value).toBe("");
    expect(new Date(cleared.attrs.expires).getTime()).toBeLessThanOrEqual(Date.now());
  });

  test("an unsigned token (alg: none) is rejected", async () => {
    const { userId } = await signedInAgent();
    const unsigned = jwt.sign({ id: userId }, null, { algorithm: "none" });

    const res = await request(app).get("/api/monitor").set("Cookie", `jwt=${unsigned}`);
    expect(res.status).toBe(401);
  });

  test("a token signed with the right secret but a different algorithm is rejected", async () => {
    const { userId } = await signedInAgent();
    const hs512 = jwt.sign({ id: userId }, SECRET(), { algorithm: "HS512" });

    const res = await request(app).get("/api/monitor").set("Cookie", `jwt=${hs512}`);
    expect(res.status).toBe(401);
  });

  test("a tampered token is rejected", async () => {
    const { agent, userId } = await signedInAgent();
    const valid = jwt.sign({ id: userId }, SECRET(), { algorithm: "HS256", expiresIn: 60 });
    const [header, , signature] = valid.split(".");
    const otherPayload = Buffer.from(JSON.stringify({ id: "507f1f77bcf86cd799439011", iat: 1 })).toString("base64url");

    const res = await request(app).get("/api/monitor").set("Cookie", `jwt=${header}.${otherPayload}.${signature}`);
    expect(res.status).toBe(401);
    await agent.get("/api/monitor").expect(200); // the real session is unaffected
  });

  test.each([["garbage"], ["a.b.c"], [""]])("a malformed token (%p) is rejected without a server error", async (token) => {
    const res = await request(app).get("/api/monitor").set("Cookie", `jwt=${token}`);
    expect(res.status).toBe(401);
  });

  test("a validly signed token with a non-ObjectId id is rejected without a server error", async () => {
    const consoleLog = jest.spyOn(console, "log").mockImplementation(() => {});
    const odd = jwt.sign({ id: "not-an-object-id" }, SECRET(), { algorithm: "HS256", expiresIn: 60 });

    const res = await request(app).get("/api/monitor").set("Cookie", `jwt=${odd}`);
    expect(res.status).toBe(401);
    consoleLog.mockRestore();
  });

  test("tokens from the old hardcoded secret no longer work", async () => {
    const { userId } = await signedInAgent();
    // Any secret other than JWT_SECRET (such as a hardcoded value from an old
    // version) must be rejected. The real old value isn't kept in the code.
    const legacy = jwt.sign({ id: userId }, "retired-secret-placeholder");

    const res = await request(app).get("/api/monitor").set("Cookie", `jwt=${legacy}`);
    expect(res.status).toBe(401);
  });
});

describe("session cookie attributes", () => {
  test("login sets HttpOnly, SameSite=Lax, Path=/, Max-Age matching the token, and no Secure outside production", async () => {
    const creds = testCredentials();
    await request(app).post("/api/signup").send(creds).expect(200);
    const res = await request(app).post("/api/login").send({ email: creds.email, password: creds.password });

    const { attrs } = parseCookie(jwtCookie(res));
    expect(attrs.httponly).toBe(true);
    expect(attrs.samesite).toBe("Lax");
    expect(attrs.path).toBe("/");
    expect(attrs["max-age"]).toBe(String(24 * 60 * 60));
    expect(attrs.secure).toBeUndefined();
  });

  test("cookies are Secure in production", async () => {
    process.env.NODE_ENV = "production";
    try {
      const res = await request(app).post("/api/signup").send(testCredentials());
      const { attrs } = parseCookie(jwtCookie(res));
      expect(attrs.secure).toBe(true);
      expect(attrs.httponly).toBe(true);
    } finally {
      process.env.NODE_ENV = "test";
    }
  });

  test("COOKIE_SAME_SITE=strict is applied", async () => {
    process.env.COOKIE_SAME_SITE = "strict";
    try {
      const res = await request(app).post("/api/signup").send(testCredentials());
      expect(parseCookie(jwtCookie(res)).attrs.samesite).toBe("Strict");
    } finally {
      delete process.env.COOKIE_SAME_SITE;
    }
  });

  test("logout clears the cookie with the same Path, SameSite, HttpOnly, and Secure flags", async () => {
    process.env.NODE_ENV = "production";
    try {
      const { agent } = await signedInAgent();
      const res = await agent.post("/api/logout");

      expect(res.status).toBe(200);
      const { value, attrs } = parseCookie(jwtCookie(res));
      expect(value).toBe("");
      expect(new Date(attrs.expires).getTime()).toBeLessThanOrEqual(Date.now());
      expect(attrs).toMatchObject({ path: "/", samesite: "Lax", httponly: true, secure: true });
    } finally {
      process.env.NODE_ENV = "test";
    }
  });
});
