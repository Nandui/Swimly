# Site Monitoring

Owner request, 20 October 2026: "on a task creation if a value is outside of range this should
trigger an action automatically for the managers, on a page called Site Monitoring". It is the
first app in the **Managers** group.

## What it does

- When someone **completes** a task in Tasks and a number they recorded is outside the range the
  template sets (minimum, maximum or both, on the field in Manage tasks), Tasks announces it
  (`tasks.reading.out_of_range`, docs/architecture/events.md). Site Monitoring raises one action
  per reading out of range, at once, with no one having to raise it.
- Each action shows the reading and its unit, the range allowed, the task, the site, who
  recorded it and when, the task's guidance for that reading, and a link to the task.
- **Site Monitoring** (`/site-monitoring`) lists the open actions at the person's sites, oldest
  first, then the latest 30 closed with who closed them, when, and what was done.
- Managers with **Act** close an action by saying what was done (3 to 1,000 characters), or open
  a closed one again, which clears what was written. Every change is audited (module Site
  Monitoring); raising is audited as done for the person who recorded the reading.
- Home and the starter page (`/site-monitoring/overview`) show how many are open.
- The same reading announced twice (a retry) raises one action. A task reopened and completed
  again with a different value raises a new one. Actions are closed, never deleted.
- Saving progress on a task raises nothing: only completing it does. Tasks' own follow-up actions
  (`/tasks/actions`) are unchanged; they are what staff raise and reviewers resolve. Site
  Monitoring is the managers' list, raised for them automatically.
- No emails are sent.

## Access

| Level | Permissions | Lets you |
| --- | --- | --- |
| View | `site-monitoring.read` | See the actions at your sites and what was done |
| Act | `site-monitoring.act` | Also close actions with what was done, and open them again |

Reach is the person's sites (`sitesFor`). New apps are hidden until a role is given a level in
Admin › Roles. **Admin: Manage** holds Act everywhere.

## Files

- Schema: `prisma/schema/site-monitoring.prisma` (`MonitoringAction`, table `monitoring_actions`);
  migration `20261127120000_site_monitoring` (additive, one new table)
- `src/modules/site-monitoring/`: `shared/` (`rules.ts`, `access.ts`), features `actions` (the
  listener `raise.ts`, the list, closing and the home count) and `workspace`; `module.ts`
  registers the home card and the listener
- Routes: `src/app/site-monitoring/`
- Tests: `src/modules/site-monitoring/__tests__/site-monitoring.test.ts`; Tasks' end-to-end test
  checks the event is announced
