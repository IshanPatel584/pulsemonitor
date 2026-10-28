const crypto = require("node:crypto");

// Custom request headers for monitors (API keys, bearer tokens, ...).
//
// Values are write-only: they are encrypted with AES-256-GCM before they are
// stored, decrypted only by the monitoring engine right before a check, and
// never returned by the API, written to logs, or included in error messages.
// The key comes from MONITOR_CREDENTIALS_KEY; without it, monitors can't be
// given headers, but everything else keeps working.

const MAX_HEADERS = 10;
const MAX_VALUE_LENGTH = 4096;
const HEADER_NAME = /^[A-Za-z0-9!#$%&'*+.^_`|~-]{1,64}$/; // RFC 9110 token
// Visible ASCII, spaces and tabs only: no CR/LF (header injection) or NUL.
const HEADER_VALUE = /^[\t\x20-\x7e]+$/;

// Headers that control the connection or routing, or that the engine sets
// itself. Allowing them could smuggle requests or misreport the target.
const FORBIDDEN = new Set([
  "host",
  "content-length",
  "transfer-encoding",
  "connection",
  "keep-alive",
  "upgrade",
  "te",
  "trailer",
  "expect",
  "via",
  "forwarded",
  "x-real-ip",
]);
const FORBIDDEN_PREFIXES = ["proxy-", "x-forwarded-"];

const KEY_HELP = 'Set MONITOR_CREDENTIALS_KEY to 32 random bytes, e.g. node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'base64\'))"';

class HeaderError extends Error {}

/**
 * Returns the 32-byte key, or null when MONITOR_CREDENTIALS_KEY is unset.
 * Throws (without echoing the value) when it is set but malformed.
 */
function loadCredentialsKey(env = process.env) {
  const raw = env.MONITOR_CREDENTIALS_KEY;
  if (!raw) return null;
  const key = /^[0-9a-f]{64}$/i.test(raw) ? Buffer.from(raw, "hex") : Buffer.from(raw, "base64");
  if (key.length !== 32) {
    const err = new Error(`MONITOR_CREDENTIALS_KEY must be 32 bytes (64 hex or 44 base64 characters). ${KEY_HELP}`);
    err.code = "EAUTHCONFIG";
    throw err;
  }
  return key;
}

// Bound to the monitor and header name, so a stored value can't be copied to
// another monitor or another header and still decrypt.
const aad = (monitorId, name) => Buffer.from(`${monitorId}:${name.toLowerCase()}`);

function encryptValue(key, monitorId, name, value) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(aad(monitorId, name));
  const data = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64"), cipher.getAuthTag().toString("base64"), data.toString("base64")].join(":");
}

function decryptValue(key, monitorId, name, stored) {
  const [version, iv, tag, data] = String(stored).split(":");
  if (version !== "v1" || !iv || !tag || !data) throw new Error("unrecognised format");
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(iv, "base64"));
  decipher.setAAD(aad(monitorId, name));
  decipher.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(data, "base64")), decipher.final()]).toString("utf8");
}

const isForbidden = (lower) => FORBIDDEN.has(lower) || FORBIDDEN_PREFIXES.some((p) => lower.startsWith(p));

/**
 * Validates headers from a create/update request and returns them ready to
 * store: [{ name, value: <encrypted> }].
 *
 * Input: [{ name, value }]. On update, an entry with a name that is already
 * saved and no value keeps the saved value; omitted names are removed.
 * Throws HeaderError with a user-facing message (never containing a value).
 */
function prepareHeaders(input, { monitorId, existing = [], env = process.env } = {}) {
  if (!Array.isArray(input)) throw new HeaderError("Headers must be a list of { name, value } entries.");
  if (input.length > MAX_HEADERS) throw new HeaderError(`You can add at most ${MAX_HEADERS} headers.`);

  const saved = new Map(existing.map((h) => [h.name.toLowerCase(), h]));
  const seen = new Set();
  let key;
  const prepared = [];

  for (const entry of input) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) throw new HeaderError("Each header needs a name and a value.");
    const name = typeof entry.name === "string" ? entry.name.trim() : "";
    if (!HEADER_NAME.test(name)) throw new HeaderError("Header names may only contain letters, digits and - _ . (up to 64 characters).");
    const lower = name.toLowerCase();
    if (isForbidden(lower)) throw new HeaderError(`The ${name} header can't be set on a monitor.`);
    if (seen.has(lower)) throw new HeaderError(`The ${name} header is listed twice.`);
    seen.add(lower);

    const { value } = entry;
    if (value === undefined || value === null || value === "") {
      const kept = saved.get(lower);
      if (!kept) throw new HeaderError(`Enter a value for the ${name} header.`);
      prepared.push({ name, value: kept.value });
      continue;
    }
    if (typeof value !== "string") throw new HeaderError(`The value of the ${name} header must be text.`);
    if (value.length > MAX_VALUE_LENGTH) throw new HeaderError(`The value of the ${name} header is too long (max ${MAX_VALUE_LENGTH} characters).`);
    if (!HEADER_VALUE.test(value)) throw new HeaderError(`The value of the ${name} header contains characters that aren't allowed (such as line breaks).`);

    key ??= loadCredentialsKey(env);
    if (!key) throw new HeaderError("Custom headers are turned off on this server because MONITOR_CREDENTIALS_KEY isn't set.");
    prepared.push({ name, value: encryptValue(key, String(monitorId), name, value) });
  }
  return prepared;
}

/**
 * Stored headers → { name: plainValue } for one check. Throws a generic error
 * (no values, no key material) if the key is missing or a value won't decrypt.
 */
function decryptHeaders(monitorId, stored, env = process.env) {
  if (!stored || stored.length === 0) return {};
  const key = loadCredentialsKey(env);
  if (!key) throw new Error("Saved request headers can't be used: MONITOR_CREDENTIALS_KEY isn't set");
  const headers = {};
  for (const h of stored) {
    try {
      headers[h.name.toLowerCase()] = decryptValue(key, String(monitorId), h.name, h.value);
    } catch {
      throw new Error(`Saved value of the ${h.name} header can't be decrypted; re-enter it`);
    }
  }
  return headers;
}

module.exports = { prepareHeaders, decryptHeaders, loadCredentialsKey, HeaderError, MAX_HEADERS };
