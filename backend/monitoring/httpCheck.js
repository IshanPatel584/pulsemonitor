const http = require("node:http");
const https = require("node:https");
const { checkUrlTarget, safeLookup } = require("./ssrf");

// Whole-request budget (DNS + connect + TLS + response headers).
const TIMEOUT_MS = Number(process.env.MONITOR_TIMEOUT_MS) || 10000;

const BODY_METHODS = new Set(["POST", "PUT", "PATCH"]);

function describeError(err) {
  switch (err.code) {
    case "ETIMEDOUT":
      return `Timed out after ${TIMEOUT_MS} ms`;
    case "EBLOCKED":
      return `Blocked: ${err.message}`;
    case "ENOTFOUND":
    case "EAI_AGAIN":
      return `DNS lookup failed for ${err.hostname ?? "host"}`;
    case "ECONNREFUSED":
      return "Connection refused";
    case "ECONNRESET":
      return "Connection reset by server";
    case "EHOSTUNREACH":
    case "ENETUNREACH":
      return "Host unreachable";
    default:
      if (err.code && /CERT|SSL|TLS/i.test(err.code)) return `TLS error: ${err.code}`;
      return err.message || "Request failed";
  }
}

/**
 * Sends one request to the monitor's URL with its HTTP method and resolves
 * (never rejects) with { checkedAt, statusCode, responseTime, error }.
 *
 * - Redirects are not followed; a 3xx is reported as-is.
 * - Only the response headers are read; the body is discarded unread.
 * - responseTime is the time to response headers, or null if no response arrived.
 * - `headers` ({ lowercase-name: value }, already validated and decrypted) are
 *   added to this one request to the monitor's own, SSRF-checked URL. Since
 *   redirects aren't followed, they never reach any other host.
 */
function performCheck({ url, method, headers = {} }) {
  const checkedAt = new Date();
  const started = Date.now();

  const blockedReason = checkUrlTarget(url);
  if (blockedReason) {
    return Promise.resolve({ checkedAt, statusCode: null, responseTime: null, error: `Blocked: ${blockedReason}` });
  }

  return new Promise((resolve) => {
    let settled = false;
    let timer = null;
    const finish = (result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ checkedAt, ...result });
    };
    const fail = (err) => finish({ statusCode: null, responseTime: null, error: describeError(err) });

    const target = new URL(url);
    const client = target.protocol === "https:" ? https : http;
    const options = {
      method,
      lookup: safeLookup,
      agent: false, // fresh connection per check, so timing includes connect
      headers: {
        "user-agent": "PulseMonitor/1.0 (uptime check)",
        accept: "*/*",
        ...headers,
        ...(BODY_METHODS.has(method) ? { "content-length": "0" } : {}),
      },
    };

    let req;
    try {
      req = client.request(target, options, (res) => {
        finish({ statusCode: res.statusCode, responseTime: Date.now() - started, error: null });
        res.on("error", () => {});
        res.destroy();
      });
    } catch (err) {
      fail(err);
      return;
    }

    timer = setTimeout(() => {
      const err = new Error("timeout");
      err.code = "ETIMEDOUT";
      req.destroy(err);
    }, TIMEOUT_MS);

    req.on("error", fail);
    req.end();
  });
}

module.exports = { performCheck, TIMEOUT_MS };
