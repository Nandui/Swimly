# 0013: Add the Site Monitoring module and the first event

**Status:** Accepted (20 October 2026, Fernando asked for it; final when he merges the PR).

## Context
Fernando asked (20 October 2026) that a task completed with a value outside its range raise an
action for managers automatically, on a page called Site Monitoring. The same day he asked for a
Managers group of modules. Tasks already flags readings out of range and has follow-up actions,
but those are raised by staff and resolved by reviewers inside Tasks.

## Decision
- A new module `site-monitoring` in the Managers group: features `actions` and `workspace`, routes
  in `src/app/site-monitoring`, starter page `/site-monitoring/overview`, levels View and Act at
  the person's sites (`site-monitoring.read`, `.act`).
- Its own table, `MonitoringAction` (`monitoring_actions`), with plain site and person ids.
- Tasks does not call it. Tasks emits `tasks.reading.out_of_range` after a completion is saved, and
  Site Monitoring listens (CLAUDE.md section 6). It is the first event on the bus.
- Events are sent through `announce` in `src/modules/contributions.ts`, which loads every module's
  `module.ts` (the composition root) before emitting, so the listener is registered whichever page
  completed the task. The platform bus still knows no module.
- The listener is idempotent by `sourceKey`, so a repeated announcement raises nothing new.

## Consequences
No change to `src/platform`. Core gained the usual catalogue entries (two permissions, one screen,
the Managers group, the audit module name). Site Monitoring works with Tasks switched off (it simply
has nothing to show), and Tasks works without it. Later sources (incidents, stock, the rota) can
raise actions here by emitting their own events.
