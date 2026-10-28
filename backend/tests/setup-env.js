// Runs before every test file (jest.config.js `setupFiles`). Gives each run a
// random, never-printed JWT secret so tests don't depend on backend/.env.
const crypto = require("node:crypto");

process.env.NODE_ENV = "test";
process.env.JWT_SECRET = crypto.randomBytes(48).toString("hex");
// Random per run, like the JWT secret: encrypts monitor header values in tests.
process.env.MONITOR_CREDENTIALS_KEY = crypto.randomBytes(32).toString("base64");
delete process.env.JWT_TTL_SECONDS;
delete process.env.COOKIE_SAME_SITE;
delete process.env.COOKIE_SECURE;
