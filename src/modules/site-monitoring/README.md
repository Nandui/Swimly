# Site Monitoring

**Purpose:** shows managers what they must act on at their sites, raised automatically.

The rules are in [docs/site-monitoring.md](../../../docs/site-monitoring.md).

## Features
- `actions` — the actions list (`/site-monitoring`): open ones oldest first, the latest closed; closing with what was done and opening again; raising them from Tasks' event; the home count.
- `workspace` — the frame, its one page list (`pages.ts`) and the starter page `/site-monitoring/overview`.

## Public API (index.ts)
- `MONITORING_STATUS_META` — the status tones, for Core's tone check.

## Data owned
- `MonitoringAction` (`monitoring_actions`) — one reading a manager must act on, and what was done.

## Events
- Emits: none.
- Listens to: `tasks.reading.out_of_range` — raises one action per reading for the site's managers.

## Permissions
- `site-monitoring.read`, `site-monitoring.act`.

## Depends on
- Platform: the event bus, the policy engine, audit, the database client, home cards (`src/modules/contributions`).
- Core reads through `src/lib/directory.ts` (`siteName`, `withSites`).
- Other modules (direct calls): none. Tasks reaches it only through the event.
