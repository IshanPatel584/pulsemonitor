const dns = require("node:dns");
const net = require("node:net");

// SSRF protection: monitors may only reach public internet hosts.
// Every address a hostname resolves to is checked against these ranges, and
// the connection is made to that same checked address (see safeLookup), so a
// DNS answer can't swap in a private IP between validation and connect.

const blockList = new net.BlockList();

[
  ["0.0.0.0", 8], // "this" network
  ["10.0.0.0", 8], // private
  ["100.64.0.0", 10], // carrier-grade NAT
  ["127.0.0.0", 8], // loopback
  ["169.254.0.0", 16], // link-local, incl. cloud metadata 169.254.169.254
  ["172.16.0.0", 12], // private
  ["192.0.0.0", 24], // IETF protocol assignments
  ["192.0.2.0", 24], // documentation
  ["192.88.99.0", 24], // 6to4 relay
  ["192.168.0.0", 16], // private
  ["198.18.0.0", 15], // benchmarking
  ["198.51.100.0", 24], // documentation
  ["203.0.113.0", 24], // documentation
  ["224.0.0.0", 4], // multicast
  ["240.0.0.0", 4], // reserved + broadcast
].forEach(([address, prefix]) => blockList.addSubnet(address, prefix, "ipv4"));

[
  ["::", 128], // unspecified
  ["::1", 128], // loopback
  // IPv4-mapped ::ffff:0:0/96 is handled in isBlockedAddress: adding it here would
  // make BlockList match every IPv4 address, since Node maps IPv4 onto that range.
  ["64:ff9b::", 96], // NAT64
  ["100::", 64], // discard
  ["2001::", 32], // Teredo
  ["2001:db8::", 32], // documentation
  ["2002::", 16], // 6to4 (embeds IPv4)
  ["fc00::", 7], // unique local, incl. AWS metadata fd00:ec2::254
  ["fe80::", 10], // link-local
  ["ff00::", 8], // multicast
].forEach(([address, prefix]) => blockList.addSubnet(address, prefix, "ipv6"));

// Names that point at the local machine or internal infrastructure
// (e.g. metadata.google.internal) regardless of what DNS says.
const BLOCKED_HOSTNAME = /^(localhost|metadata)$|\.(localhost|local|internal)$/i;

// True for IPv4-mapped IPv6 (::ffff:a.b.c.d in any spelling). URL() canonicalizes
// the address, e.g. ::ffff:127.0.0.1 and 0:0:0:0:0:ffff:7f00:1 both become ::ffff:7f00:1.
function isIPv4Mapped(address) {
  const canonical = new URL(`http://[${address}]/`).hostname.slice(1, -1);
  return /^::ffff:[0-9a-f]{1,4}:[0-9a-f]{1,4}$/.test(canonical);
}

function isBlockedAddress(address) {
  const family = net.isIP(address);
  if (!family) return true;
  if (family === 6) {
    // Monitoring targets never legitimately use IPv4-mapped addresses; refuse them all.
    return isIPv4Mapped(address) || blockList.check(address, "ipv6");
  }
  return blockList.check(address, "ipv4");
}

/**
 * Synchronous checks on the URL itself. Returns a reason string when the URL
 * must not be fetched, or null when it may proceed to DNS resolution.
 * Used by the Monitor model validator and again before every check.
 */
function checkUrlTarget(rawUrl) {
  let url;
  try {
    url = new URL(rawUrl);
  } catch {
    return "Invalid URL";
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return "Only http and https URLs can be monitored";
  }
  if (url.username || url.password) {
    return "URLs containing credentials are not allowed";
  }

  // URL() already normalizes tricks like http://2130706433/ or http://0x7f.1/ to 127.0.0.1.
  const host = url.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (BLOCKED_HOSTNAME.test(host)) {
    return "Local and internal hostnames cannot be monitored";
  }
  if (net.isIP(host) && isBlockedAddress(host)) {
    return "Private, loopback, link-local, and reserved addresses cannot be monitored";
  }
  return null;
}

/**
 * Drop-in `lookup` for http.request: resolves the hostname and refuses the
 * connection if any resolved address is private or reserved.
 */
function safeLookup(hostname, options, callback) {
  dns.lookup(hostname, { ...options, all: true }, (err, addresses) => {
    if (err) return callback(err);

    if (!addresses.length || addresses.some((a) => isBlockedAddress(a.address))) {
      const blocked = new Error(`${hostname} resolves to a private or reserved address`);
      blocked.code = "EBLOCKED";
      return callback(blocked);
    }

    if (options.all) return callback(null, addresses);
    return callback(null, addresses[0].address, addresses[0].family);
  });
}

module.exports = { checkUrlTarget, safeLookup, isBlockedAddress };
