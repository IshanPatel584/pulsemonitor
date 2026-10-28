# PulseMonitor

An API monitoring dashboard: uptime, response times, incidents, and analytics for HTTP endpoints.

> **The app has no mock or sample data.** Accounts, monitors, check history, and incidents all come from the Express backend in `../backend`. Sections with nothing recorded yet show an empty state.

## Stack

- React 18 + Vite 5
- Tailwind CSS 3, with theme tokens set as CSS variables
- React Router 6
- Recharts 2
- Lucide React icons

## Getting started

Requires Node.js 18 or newer, plus the backend running on http://localhost:5000 with MongoDB on `mongodb://localhost:27017`.

1. Start the backend (in `../backend`): `node app.js`.
2. Start the frontend:

   ```bash
   cd frontend
   npm install
   npm run dev
   ```

3. Open http://localhost:5173 and create an account.

In development the Vite server proxies `/api/*` to `http://localhost:5000`. This keeps the backend's httpOnly `jwt` cookie same-origin, and you don't need CORS. To point the proxy somewhere else, set `VITE_API_PROXY` in `.env` (see `.env.example`).

| Script            | Purpose                              |
| ----------------- | ------------------------------------ |
| `npm run dev`     | Start the dev server with HMR        |
| `npm run build`   | Production build to `dist/`          |
| `npm run preview` | Serve the production build locally   |

## Routes

| Path | Access | Page |
| --- | --- | --- |
| `/` | public | Landing page. Static content only; it never waits on the API. Signed-in visitors see "Open dashboard". |
| `/login`, `/signup` | public | Redirect to the return path (or `/overview`) once signed in |
| `/overview`, `/monitors`, `/incidents`, `/analytics`, `/settings` | signed in | Dashboard (`RequireAuth`) |
| anything else | public | 404 page |

Opening a protected URL while signed out redirects to `/login` and remembers the path. After you sign in, `safeReturnPath` (`src/config/navigation.js`) sends you back only to same-app paths. Absolute or protocol-relative URLs, `/`, `/login`, and `/signup` fall back to `/overview`, which rules out open redirects and redirect loops.

## Sessions and failure handling

- **Session check:** the session is checked once on load (`GET /api/monitor`, since the API has no "me" endpoint) and again only when you press Retry. It never runs in a loop. After 4 s a "still waiting" hint appears.
- **401:** a 401 during a session signs you out once and shows "Your session expired". Further 401s from parallel polls do nothing.
- **Network errors and timeouts:** requests time out after 15 s. Network errors and timeouts are not treated as a sign-out. The session check shows a "Couldn't reach PulseMonitor" screen with Retry, and failed background polls keep the data already on screen.
- **Session generation:** every sign-in, sign-out, and account switch bumps a counter in `src/lib/api.js`. A response from an earlier session, such as a poll still in flight during logout, is dropped. It can't show the previous user's data or sign the new session out.
- **Logout:** logout always signs you out locally. If the server can't be reached, the httpOnly cookie may still be valid, so the login page says so.
- **Other tabs:** signing out, or signing in as someone else, in another tab is picked up through the `storage` event.
- **Stored user data:** `pm.user` in localStorage is validated. Malformed values are ignored instead of crashing the app.

## Features

- **Auth**: login and signup pages with inline validation and server error messages. Unauthenticated users are redirected to `/login`. Sign out is in the user menu.
- **Landing page** (`/`): product overview, features, a product preview clearly labelled *Demo data* (fixed example values, never from the API), and sign-up / log-in calls to action.
- **Overview** (`/overview`): summary cards from your saved monitors, a response-time chart (last 24 h) and daily uptime bars (last 7 d) for the monitor picked in the chart header, a sortable monitor table, and recent incidents.
- **Monitors**: search (also synced to `?q=`), status filters with counts, sorting by column header or the Sort menu, pagination, a per-row actions menu (edit, copy URL, delete with confirmation), and loading, empty, and error states.
- **Add / Edit Monitor**: a modal with name, URL, HTTP method, check interval, and expected status code. Validation runs on blur and on submit, and the server's field errors appear under the matching field. The list is refetched after every create, update, or delete.
- **Incidents**: Open and Resolved tabs from `GET /api/incidents`. Each incident shows the monitor ("Deleted monitor" if it was removed), the reason, start time, status, resolution time, and duration. The detail panel (a drawer on small screens) has a timeline of when it opened and resolved. `?id=` opens one incident and `?monitor=` filters to one monitor ("View incidents" in a monitor's actions menu).
- **Analytics**: pick a monitor and a 24h / 7d / 30d / 90d range. You get uptime and response-time cards, uptime and response-time trend charts, and slowest endpoints (by latest response time). Most-failing ranking isn't available because history is per monitor.
- **Settings**: profile (updates the avatar menu for the session), appearance (dark, light, or system theme; collapsed sidebar; reduced motion), notification preferences, and account details (email, user ID, sign out).
- **Shell**: a collapsible sidebar (a drawer on mobile) with an open-incident count, monitor search in the top bar (press `/`), notifications for monitors going down and recovering (read state is saved in the browser), and a user menu with a theme toggle and sign out.

## Project structure

All paths below are relative to `frontend/`.

```
src/
├── main.jsx                 # Router + context providers
├── App.jsx                  # Route table
├── index.css                # Tailwind layers + light/dark design tokens
├── config/navigation.js     # Sidebar items and page titles
├── context/
│   ├── AuthContext.jsx      # Session check, login, signup, logout
│   ├── AppContext.jsx       # Monitors and incidents (API), profile, toasts
│   └── PreferencesContext.jsx  # Theme, sidebar, and motion (saved to localStorage)
├── hooks/                   # useLocalStorage, useNow, useMediaQuery
├── lib/
│   ├── api.js               # fetch wrapper (credentials: "include"), endpoints, response mapping
│   ├── format.js            # ms / % / relative-time / duration formatting
│   ├── monitors.js          # validateMonitor, sortMonitors, filterMonitors
│   └── cn.js
├── components/
│   ├── auth/                # AuthLayout, AuthForm, AuthNotice, RequireAuth
│   ├── layout/              # AppLayout, Sidebar, Topbar, Search/Notifications/User menus
│   ├── monitors/            # MonitorTable, AddMonitorModal, MonitorActionsMenu
│   ├── incidents/           # IncidentList, IncidentDetail, IncidentStatusBadge
│   ├── charts/              # ResponseTimeChart, UptimeChart, MonitorSelect, ChartStatus,
│                            # ChartEmptyState, ChartTooltip, theme
│   └── ui/                  # Button, Card, StatCard, StatusBadge,
│                            # Dropdown, Modal/Drawer/ConfirmDialog, Tabs,
│                            # SegmentedControl, Pagination, Switch, Field, Toaster,
│                            # ErrorState
└── pages/                   # Landing, Login, Signup, Overview, Monitors, Incidents, Analytics, Settings, NotFound
```

Pages put the shared components together. They don't hold data logic. All state changes go through `AppContext`.

## Backend integration

All HTTP calls live in `src/lib/api.js`. Every request sends `credentials: "include"` so the backend's `jwt` cookie is sent and stored.

| UI action                     | Request                    | Success response            |
| ----------------------------- | -------------------------- | --------------------------- |
| Sign up                       | `POST /api/signup`         | `{ user: "<id>" }` + cookie |
| Log in                        | `POST /api/login`          | `{ user: "<id>" }` + cookie |
| Sign out                      | `POST /api/logout`         | `{ success: true }`         |
| Load monitors / session check | `GET /api/monitor`         | `{ monitors: [...] }`       |
| Create monitor                | `POST /api/monitor`        | `{ monitor: "<id>" }`       |
| Edit monitor                  | `PATCH /api/monitors/:id`  | `{ monitor: {...} }`        |
| Delete monitor                | `DELETE /api/monitors/:id` | see known gaps below        |
| Monitor check history         | `GET /api/monitors/:id/history` | `{ checkresult: [...] }`, newest first |
| Incidents                     | `GET /api/incidents`       | `{ incidents: [...] }`, newest first, `monitorId` populated |

Errors come back as `{ error: "..." }` or `{ errors: { field: "message" } }`. Field errors appear next to the matching input. Any 401 signs the user out and redirects to `/login`.

### Known backend gaps (frontend works around them)

- **List and create use `/api/monitor` (singular)**, while update and delete use `/api/monitors/:id`. The client calls the paths as the backend registers them.
- **`GET /api/monitors/:id` isn't routed.** `getMonitorById` exists in the controller but has no route, so it returns 404. The frontend doesn't need it.
- **Delete always responds 400 "Invalid monitor ID"**, even when it works. `deleteMonitor` reads `monitor.deletedCount`, but `monitor` is undefined. The frontend refetches the list after a 400 and treats the delete as successful if the monitor is gone.
- **There's no "current user" endpoint.** The session is checked with `GET /api/monitor` (200 means signed in, 401 means not). Login returns only the user id, so the name and email shown in the UI are the values typed into the forms, remembered in localStorage.
- **CORS isn't enabled** (the `cors` package is installed but unused), so the browser can't call `http://localhost:5000` directly from port 5173. The Vite dev proxy avoids this. For a production build served from another origin, the backend needs `cors({ origin, credentials: true })`, or it needs to serve the built files itself.
- **The monitoring engine sets `status` (`up | down | unknown`) and the latest-check fields** (`lastCheckedAt`, `lastResponseTime`, `lastStatusCode`, `lastError`). The table shows them and refetches monitors every 15 s while the tab is visible. Monitors have no uptime or pause state, so the Uptime column shows "—" and pause/resume isn't offered.
- **Incidents are read-only.** The scheduler opens an incident when a check fails and resolves it on the next passing check. The API has no acknowledge or resolve endpoints, so the UI doesn't offer those actions. Incidents and monitors are refetched together every 15 s.
- **There are no metrics, API-key, or profile endpoints.** Those sections show empty states, and profile edits last only for the session.
- **`GET /api/monitors/:id/history` has no range or limit parameters.** It returns every stored check (up to the 30-day retention), newest first, under `checkresult`. The frontend sorts the checks by time and filters the selected range itself. It refetches only when the monitor list poll (every 15 s) shows a new `lastCheckedAt` for the selected monitor, not on a fixed timer. An invalid id returns 500 and another user's monitor returns 404, and both show as a chart error with a retry button.

The backend's model also only allows `GET | POST | PUT | PATCH | DELETE` and an interval of at least 60 seconds, and the form follows the same rules.

### Monitor shape

`normalizeMonitor` in `src/lib/api.js` maps the Mongo document to what the UI uses:

```js
{
  id: '<_id>',
  name: 'Checkout API',
  url: 'https://checkout.example.com/health',
  method: 'GET',              // GET | POST | PUT | PATCH | DELETE
  interval: 60,               // seconds, >= 60
  expectedStatus: 200,        // expectedStatusCode in the API
  status: 'unknown',          // up | down | unknown
  responseTime: 116,          // lastResponseTime (ms); null before the first check or when no response arrived
  lastChecked: 1729850000000, // lastCheckedAt as epoch ms; null before the first check
  lastStatusCode: 200,        // lastStatusCode; null when no response arrived
  lastError: null,            // lastError, e.g. "Expected status 200, got 503"
  uptime: null,               // not provided by the API yet
  createdAt: 1729850000000,
  updatedAt: 1729850000000,
}
```

## Theming

Colors are RGB channel variables in `src/index.css`. `:root` holds the light theme and `.dark` holds the dark theme. `tailwind.config.js` maps them to utilities such as `bg-surface`, `text-muted`, and `border-line`. Charts read the same variables, so they follow the theme. Dark is the default. The theme you pick is saved under `pm.theme` in localStorage.

## Charts and check history

Chart math lives in `src/lib/history.js` and uses only recorded checks:

- **Uptime** is successful checks ÷ all checks in the period. Failed checks (timeouts, DNS errors, wrong status) count. A period with no checks has no value: the bar or line point is left empty instead of being shown as 0% or 100%. A 0% period still shows a thin red bar.
- **Response time** plots each check that got an HTTP response, at its `checkedAt` time. Checks with `responseTime: null` are skipped. With more than ~200–240 checks in range, the chart groups them into equal time buckets and shows the average and p95.
- **Time axis**: when a monitor's history is shorter than the selected range, the axis starts at its first check instead of squeezing the points to the right edge.

`useMonitorHistory(monitorId, lastChecked)` loads the history for the selected monitor and reloads it quietly whenever that monitor's `lastChecked` changes.

### Testing the charts with real data

1. Start the backend (`npm run dev` in `../backend`) and the frontend (`npm run dev`), then sign in.
2. Add two monitors with a 1-minute interval:
   - `https://example.com/`, GET, expected status 200. This one succeeds.
   - `https://httpbin.org/status/503`, GET, expected status 200. This one fails, but still returns a response time.
3. Wait 2–3 minutes. The first check runs within about 5 s, then once per minute.
4. **Overview**: pick each monitor in the Response time card's dropdown. The first one shows real response times and a green **Today** bar at 100%. The second one shows its response times and a thin red bar at 0.00%. Both charts update on their own after each new check, with no reload.
5. **Analytics**: choose a monitor and switch between 24h, 7d, 30d, and 90d. The cards show for example "5 of 5 checks succeeded" and "p95 … ms · 5 responses", and they match the trend charts.
6. To compare with the raw data, sign in and open `http://localhost:5173/api/monitors/<id>/history` in the same browser (the Vite proxy forwards it to the backend).
