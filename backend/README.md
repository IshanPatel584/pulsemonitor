# PulseMonitor backend

Express + MongoDB API for PulseMonitor.

```bash
npm install
cp .env.example .env   # then set JWT_SECRET (see below)
npm run dev            # nodemon
# or
npm start
```

The server listens on http://localhost:5000 and connects to `mongodb://localhost:27017/APImanagement`.

## Configuration

Settings come from environment variables. On startup, `backend/.env` is loaded with `dotenv`, and variables already set in the environment take precedence. See `.env.example` for the full list.

| Variable | Required | Default | Purpose |
| --- | --- | --- | --- |
| `JWT_SECRET` | **yes** | none | Signs session tokens (HS256). At least 32 characters. |
| `NODE_ENV` | no | none | `production` makes cookies always `Secure`. |
| `JWT_TTL_SECONDS` | no | `86400` | Token and cookie lifetime. |
| `COOKIE_SAME_SITE` | no | `lax` | `strict`, `lax`, or `none`. `none` forces `Secure`. |
| `COOKIE_SECURE` | no | `false` | `true` forces `Secure` outside production. |
| `MONITOR_CREDENTIALS_KEY` | for custom headers | none | 32 random bytes (base64 or hex) that encrypt monitor header values. Without it, monitors work but can't be given headers. |

Generate a secret:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

**There is no fallback secret.** If `JWT_SECRET` is missing or shorter than 32 characters, `npm start` / `npm run dev` print `[config] …` and exit before connecting to MongoDB. The message never includes the secret itself. In production, set `JWT_SECRET` through your host's secret store, not a committed file.

### Sessions

- Login and signup set a `jwt` cookie holding an HS256 token that expires after `JWT_TTL_SECONDS`. The cookie's `Max-Age` matches.
- The cookie is always `HttpOnly`, `SameSite=Lax` (configurable), and `Path=/`. It's also `Secure` in production.
- Every request verifies the signature, expiry, and algorithm (only HS256 is accepted, so `alg: none` and other algorithms are refused). An expired or invalid token means the user is treated as signed out (401 on protected routes) and the stale cookie is cleared.
- Logout clears the cookie with the same name, path, and flags it was set with.

## Monitoring engine

The engine starts automatically once MongoDB connects (`startScheduler()` in `app.js`). It uses only Node built-ins (`http`, `https`, `dns`, `net`), with no extra dependencies.

| File | Purpose |
| --- | --- |
| `monitoring/scheduler.js` | Every 5 s, finds monitors whose `interval` has elapsed since `lastCheckedAt` and checks them |
| `monitoring/httpCheck.js` | Sends one request with the monitor's method and measures time to response headers |
| `monitoring/ssrf.js` | Blocks localhost, private/reserved IP ranges, and cloud metadata endpoints |
| `models/CheckResult.js` | One document per check: `checkedAt`, `statusCode`, `responseTime` (ms), `success`, `error` |

How it behaves:

- **Status.** A response status equal to `expectedStatusCode` marks the monitor `up`. Anything else is `down`, including a different status, timeout, DNS failure, refused connection, TLS error, or a blocked URL.
- **Monitor fields.** The monitor keeps the latest result in `status`, `lastCheckedAt`, `lastStatusCode`, `lastResponseTime`, and `lastError`. `GET /api/monitor` returns these fields.
- **No overlap.** A monitor that's still being checked is skipped, and at most 10 checks run at once (`MONITOR_MAX_CONCURRENCY`).
- **Timeouts and redirects.** Each check has a 10 s timeout (`MONITOR_TIMEOUT_MS`). Redirects aren't followed, so a 301/302 is compared as-is. The response body is never downloaded.
- **Owner isolation.** Results are written only to the checked monitor, matched by `_id` and `userId`. If the owner edits the URL, method, or expected status mid-check, the stale result isn't applied.
- **Retention.** Check results expire after 30 days through a TTL index (`CHECK_RETENTION_DAYS`).
- **One scheduler per process.** Its state lives on `globalThis`, so re-requiring the module doesn't start a second one. If you run several backend instances, each one runs its own scheduler.

### SSRF protection

- **At create/edit time**, the Monitor model rejects these:
  - URLs that aren't http(s)
  - URLs with embedded credentials
  - `localhost`, `*.local`, and `*.internal` (e.g. `metadata.google.internal`)
  - IP literals in private, loopback, link-local (incl. `169.254.169.254`), CGNAT, multicast, or reserved ranges, in IPv4 and IPv6 (including IPv4-mapped forms like `[::ffff:127.0.0.1]` and numeric tricks like `http://2130706433/`)
- **At check time**, the URL is checked again and the hostname is resolved. If any resolved address is private or reserved, the check is refused. The socket connects to the exact address that was validated, so DNS rebinding can't swap in an internal IP.

Because of this, you can't monitor services on your own machine or LAN (e.g. `http://localhost:3000`).

## Testing checks

Create monitors from the frontend (or with `POST /api/monitor`). Within about 5 seconds each one gets its first check. Refresh the dashboard, or call `GET /api/monitor` and look at `status`, `lastStatusCode`, `lastResponseTime`, and `lastError`.

| Scenario | URL | Method | Expected status | Result |
| --- | --- | --- | --- | --- |
| Successful endpoint | `https://example.com/` | GET | 200 | `up`, `lastStatusCode: 200` |
| Unexpected status code | `https://httpbin.org/status/503` | GET | 200 | `down`, `lastError: "Expected status 200, got 503"` |
| Unreachable endpoint | `https://pulse-check-does-not-exist.invalid/` | GET | 200 | `down`, `lastError: "DNS lookup failed for ..."` |
| Timeout | `https://httpbin.org/delay/15` | GET | 200 | `down`, `lastError: "Timed out after 10000 ms"` |
| SSRF blocked | `http://169.254.169.254/` | GET | 200 | Rejected with a 400 on create |

`.invalid` is reserved and never resolves, so it always fails. To see individual check history:

```bash
mongosh APImanagement --eval 'db.checkresults.find().sort({ checkedAt: -1 }).limit(10)'
```

## Authenticated monitors (custom headers)

Monitors can send up to 10 custom request headers, such as `Authorization: Bearer …` or `X-API-Key: …`, for APIs that need credentials.

Enable it by adding a key to `backend/.env` and restarting:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
# MONITOR_CREDENTIALS_KEY=<output>
```

How header values are handled:

- **Encrypted at rest.** Values are encrypted with AES-256-GCM (`monitoring/credentials.js`) before they're saved. Each value is bound to its monitor and header name, so a stored value copied elsewhere won't decrypt.
- **Write-only.** No response includes a header value or its ciphertext: monitor responses return `headers: [{ name, configured: true }]`, and admin views omit headers entirely. Values never appear in logs or error messages.
- **Used only at check time.** The scheduler decrypts values right before a check and sends them only to the monitor's own URL. That URL is SSRF-checked on every check, including DNS, and redirects aren't followed.
- **Validated.** Names must be valid header tokens. Values can't contain line breaks or control characters, and are capped at 4096 characters. Routing and connection headers (`Host`, `Content-Length`, `Transfer-Encoding`, `Connection`, `Proxy-*`, `X-Forwarded-*`, …) can't be set.
- **Updating headers.** `PATCH` with `headers: [{ name, value }]` replaces the list. A `{ name }` entry with no value keeps that header's saved value, and an omitted header is removed. Leaving `headers` out of the request leaves them unchanged.
- **Changing host.** If the URL moves to a different origin, every value must be entered again. Otherwise the request fails with `400`, so a credential is never sent to a host it wasn't entered for.
- **Key changes.** If the key is missing or has changed, checks of monitors with headers fail with "can't be decrypted; re-enter it". The request isn't sent. Keep the key stable and secret: changing it means re-entering every value.

## Admin Portal

Accounts have a `role`: `client` (default) or `admin`. Admins can open the Admin Portal in the frontend (`/admin`), which reads data across all accounts.

### Creating the first admin

There's no HTTP route that grants admin to yourself, and sign-up ignores any `role` in the request body. The first admin is created on the server:

1. Sign up in the app as usual.
2. In `backend/`, run:

   ```bash
   npm run set-role -- --email you@example.com --role admin
   ```

`scripts/set-role.js` connects to MongoDB (`MONGO_URL`, default `mongodb://localhost:27017/APImanagement`) and changes the role of an **existing** account. It never creates accounts or touches passwords. It prints only the email and the new role, and it refuses to remove the last admin. The change applies on the account's next request, because the role is read from the database on every request, not from the token.

After that, admins can promote or demote other users in **Admin Portal → Users** (with a confirmation). Admins can't change their own role, so there is always at least one admin. Each change is logged as `[admin] role of user <id> set to "<role>" by admin <id>` (ids only).

### Admin API

Every route is mounted under `/api/admin` behind `requiredAuth` and `requireRole("admin")` (`routes/adminRoutes.js`). Signed-out requests get `401` and non-admins `403`, before any handler runs. This also applies to unknown `/api/admin/*` paths, so they don't reveal which routes exist.

| Method and path | Purpose |
| --- | --- |
| `GET /api/me` | The signed-in user's `{ id, username, email, role }`. Any signed-in user. |
| `GET /api/admin/stats` | Totals for users, monitors, incidents and checks in the last 24 h, plus recent sign-ups and incidents |
| `GET /api/admin/analytics?days=7\|14\|30\|90` | Daily UTC series: registrations, incidents opened and resolved, check success and failure, average response time |
| `GET /api/admin/users?page&limit&search&role&sort` | Paginated users with monitor counts |
| `GET /api/admin/users/:id` | One user with their monitors, incident counts and recent incidents |
| `PATCH /api/admin/users/:id/role` | Body `{ "role": "client" \| "admin" }`. Not allowed on yourself. |
| `GET /api/admin/monitors?page&limit&search&status&userId&sort` | Monitors from all accounts, with their owners |
| `GET /api/admin/monitors/:id` | One monitor with its last 50 checks, a 24 h summary and recent incidents |
| `GET /api/admin/incidents?page&limit&search&status&monitorId&userId&sort` | Incidents from all accounts |
| `GET /api/admin/health` | Database state and ping, scheduler state, last check, overdue monitors, process uptime and memory |
| `GET /api/admin/settings` | Effective non-secret configuration |

How the endpoints behave:

- **Validation.** `limit` is 1–100 (default 20). `page` is a whole number of at least 1. `sort` takes a field from an allow-list, prefixed with `-` for descending. Search text is at most 100 characters and is matched literally, never as a regex. Ids must be 24 hex characters. Anything else gets a `400`; an unknown id gets a `404`.
- **Errors.** Database failures return a generic `500` message. The details go only to the server log.
- **What's never returned.** Responses are built from allow-lists, so password hashes, tokens, cookies and `JWT_SECRET` are never included. The User model also strips `password` from any serialised document.
- **URL redaction.** Query-parameter values in monitor URLs whose names look like credentials (`api_key`, `token`, `secret`, `password`, `auth`, `sig`, …) are shown as `REDACTED`.
- **Read-only monitors.** Admins can't create or edit monitors, so the SSRF rules apply unchanged.
- **Registration dates** come from each user's ObjectId timestamp, since the User schema has no `createdAt`.
- **Check data** is subject to the 30-day retention period. Older analytics days return `null` for check counts, not `0`.
- **Not available.** The backend doesn't record logins or an activity log, so "active users" and system activity aren't reported. Account deletion, password resets and suspension aren't implemented. See the limitations below.

### Not implemented: endpoints these would need

| Feature | Endpoint it would need | Authorization |
| --- | --- | --- |
| Active users / last login | Record `lastLoginAt` in `login_post`, then expose it in `GET /api/admin/users` | admin |
| Audit log | An `AuditEvent` model written by role changes and logins, plus `GET /api/admin/audit?page&limit` | admin |
| Suspend an account | A `suspendedAt` field checked in `currentuser`, plus `PATCH /api/admin/users/:id/status` | admin, not on yourself |
| Delete an account | `DELETE /api/admin/users/:id`, removing their monitors, incidents and check results in one operation | admin, not on yourself, with confirmation |
| Password reset | A token-based reset flow (`POST /api/password-reset`, `POST /api/password-reset/:token`) with emailed single-use tokens. Admins should never set passwords. | public, rate-limited |

## Automated tests

Jest and Supertest, run against a throwaway MongoDB database:

```bash
npm test
```

- **Secrets:** `tests/setup-env.js` sets a random `JWT_SECRET` for each run, so tests never read or need `backend/.env`.
- **Database:** each test file connects to a new database named `pulsemonitor_test_<pid>_<time>` on `mongodb://127.0.0.1:27017`. Override the server with `TEST_MONGO_URL`. Documents are cleared after every test and the database is dropped when the file finishes. `tests/helpers/db.js` refuses any database whose name doesn't contain `_test`, so the development database `APImanagement` is never touched.
- **No network:** `app.js` only connects to MongoDB, listens, and starts the scheduler when run directly, so tests import `app` without side effects. Scheduler tests mock `monitoring/httpCheck.performCheck`, so no HTTP request leaves the process, and timing is controlled through `lastCheckedAt` rather than by waiting.
- **Coverage:**

  | File | Covers |
  | --- | --- |
  | `tests/auth.test.js` | signup and login, validation, duplicate email, role injection, NoSQL-operator login, 401s, logout, token expiry, invalid/`alg:none`/tampered tokens, cookie attributes |
  | `tests/monitors.test.js` | create, list, get, update, and delete; validation and SSRF rules; ownership; invalid IDs |
  | `tests/incidents.test.js` | `GET /api/incidents`: auth, isolation, sort order, populate, deleted monitors |
  | `tests/history.test.js` | `GET /api/monitors/:id/history`: isolation, sort order, 404s, invalid IDs |
  | `tests/scheduler.test.js` | `runCheck` and `tick`: incident open and resolve, no duplicates, stale results, recorded checks, due/not-due, no overlap |
  | `tests/ssrf.test.js` | URL and IP block rules |
  | `tests/admin.test.js` | 401/403/200 for every admin route, privilege escalation via signup, `/api/me` and monitor updates, immediate effect of demotion, stats, analytics and retention gaps, user/monitor/incident lists (pagination, search, filters, sort, invalid params, malformed ids, 404s, empty results, DB failures), role changes, URL redaction, health, settings without secrets |
  | `tests/monitorHeaders.test.js` | header create, read, update and delete; encryption at rest; names-only responses; validation (injection, forbidden headers, duplicates, limits); missing key; ownership; host-change re-entry; admin views; scheduler decryption, key mismatch and copied ciphertext; no values in logs |
  | `tests/httpCheck.test.js` | `performCheck`: blocked targets never connect, method and URL, headers on the request, `Content-Length` can't be overridden; `safeLookup` DNS SSRF guard; credentials key format |
  | `tests/config.test.js` | required and short `JWT_SECRET`, TTL and cookie settings, server refuses to start without a secret |
