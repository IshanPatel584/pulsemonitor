// Authentication settings, read from the environment. There is deliberately no
// fallback secret: a missing or weak JWT_SECRET is a startup error everywhere.

const MIN_SECRET_LENGTH = 32;
const DEFAULT_TTL_SECONDS = 24 * 60 * 60; // 1 day
const SAME_SITE_VALUES = ["strict", "lax", "none"];

// Messages name the variable but never echo its value.
function configError(message) {
  const err = new Error(message);
  err.code = "EAUTHCONFIG";
  return err;
}

/**
 * Validates and returns the auth configuration. Throws (code EAUTHCONFIG) when
 * JWT_SECRET is missing/too short or another setting is invalid.
 *
 * - JWT_SECRET          required, at least 32 characters
 * - JWT_TTL_SECONDS     token and cookie lifetime, default 86400 (1 day)
 * - COOKIE_SAME_SITE    strict | lax | none, default lax ("none" forces Secure)
 * - COOKIE_SECURE       "true" to force Secure outside production; always Secure in production
 */
function loadAuthConfig(env = process.env) {
  const secret = env.JWT_SECRET;
  if (!secret) {
    throw configError("JWT_SECRET is not set. Add it to backend/.env (see .env.example).");
  }
  if (secret.length < MIN_SECRET_LENGTH) {
    throw configError(`JWT_SECRET must be at least ${MIN_SECRET_LENGTH} characters long.`);
  }

  const ttlSeconds = env.JWT_TTL_SECONDS === undefined || env.JWT_TTL_SECONDS === "" ? DEFAULT_TTL_SECONDS : Number(env.JWT_TTL_SECONDS);
  if (!Number.isInteger(ttlSeconds) || ttlSeconds <= 0) {
    throw configError("JWT_TTL_SECONDS must be a positive whole number of seconds.");
  }

  const sameSite = (env.COOKIE_SAME_SITE || "lax").toLowerCase();
  if (!SAME_SITE_VALUES.includes(sameSite)) {
    throw configError(`COOKIE_SAME_SITE must be one of: ${SAME_SITE_VALUES.join(", ")}.`);
  }

  const production = env.NODE_ENV === "production";
  // Browsers reject SameSite=None cookies that are not Secure.
  const secure = production || env.COOKIE_SECURE === "true" || sameSite === "none";

  const cookie = { httpOnly: true, sameSite, secure, path: "/" };

  return {
    secret,
    ttlSeconds,
    algorithm: "HS256",
    cookieName: "jwt",
    // Used both to set and to clear the cookie, so the browser matches them.
    cookie,
    cookieMaxAgeMs: ttlSeconds * 1000,
  };
}

module.exports = { loadAuthConfig, MIN_SECRET_LENGTH, DEFAULT_TTL_SECONDS };
