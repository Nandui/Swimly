# Incidents

**Purpose:** records accidents, incidents and near misses from the first report to a closed, locked record.

The flow, rules and decisions are in [docs/incidents.md](../../../docs/incidents.md).

## Features
- `report` — the two-minute report form, sending it (and the serious alerts), and adding to a report later (`/incidents/new`).
- `triage` — rating, the HSA questions, closing at triage or sending to investigation, and closing an investigated report (on `/incidents/[id]`).
- `investigation` — witness statements, the 5 whys and root cause, actions with owners and their reminder emails, Your actions, and reopening (on `/incidents/[id]` and `/incidents`; reminders from `/api/cron/incidents`).
- `files` — photos and documents on a report (`/api/incidents/files`).
- `insights` — trends for those who triage and the reports past their keeping period (`/incidents/insights`).
- `export` — one report's full record to print or save as a PDF for the insurer (`/incidents/[id]/export`, Manage).
- `staff` — a staff member's incidents and injuries for their HR personal file and subject access export (registered in `module.ts`).
- `reports` — the lists (`/incidents`), one report's page (`/incidents/[id]`), the starter-page and Home counts, and the form's sites and areas.
- `workspace` — the Incidents frame and its one page list (`pages.ts`) for the page bar and the starter page `/incidents/overview`.

`shared/` holds what two or more features use: statuses, kinds, categories and the severity scale (`types.ts`), the pure rules (`rules.ts`, tested in `rules.test.ts`), the access check (`access.ts`) and the locked, audited write (`service.ts`).

## Public API (index.ts)
- `incidentStatuses`, `seriousMeta`, `SEVERITY_META` — each status's and severity's label, tone and icon. Used by Core's status-metadata test.

Nothing else in Turnfin calls into Incidents. Routes use the feature entries (`features/<feature>/index.ts`).

## Data owned
Declared in `prisma/schema/incidents.prisma`, migrations `20261031120000_incidents`, `20261101120000_incidents_investigation` and `20261102120000_incidents_staff` (new tables and new columns with defaults or nulls only):
- `incidents_reports` (`IncidentReport`) — the report, its status, triage, the whys and root cause, and closing.
- `incidents_people` (`IncidentPerson`) — who was involved, their injury and treatment, and the staff member's user id when it was one of the team.
- `incidents_witnesses` (`IncidentWitness`) — who saw it and how to reach them.
- `incidents_events` (`IncidentEvent`) — the history, addenda included.
- `incidents_access_events` (`IncidentAccessEvent`) — every read of someone else's report that names people.
- `incidents_notifications` (`IncidentNotification`) — serious-incident alert emails and their outcome.
- `incidents_statements` (`IncidentStatement`) — witness statements taken during investigation.
- `incidents_actions` (`IncidentAction`) — corrective actions, their owner, due day, outcome and reminder emails.
- `incidents_files` (`IncidentFile`) — photos and documents, stored as bytes, hidden when removed.

## Events
- Emits: none. Actions stay in Incidents rather than being copied into Tasks (docs/incidents.md).
- Listens to: none.

## Registration (module.ts)
- HR personal file section `incidents.involved` (`registerPersonFileSection`) and subject access records `incidents` (`registerSubjectRecords`).
- Starter page and Home items (`registerHomeCard`): Report an incident; your incident actions; reports to triage; serious incidents to sign off; incidents under investigation; incident actions overdue.
- Menu entry, levels and permissions: `manifest.ts`, listed in `src/app/modules.ts`.

## Permissions
- `incidents.reports.create`, `incidents.reports.review`, `incidents.reports.signoff`.

## Depends on
- Platform: auth and the policy engine (`src/lib/policy`), audit (`src/lib/audit`), email (`src/lib/email`), the database client, home cards (`src/modules/contributions`).
- Core reads (never Core tables): sites, areas and people through `src/lib/directory.ts` (`liveSitesOf`, `liveSiteById`, `areaNamesAt`, `withSite`, `withSites`, `siteName`, `activeStaffHolding`, `staffSiteIds`, `staffAccess`).
- The UI kit's workspace frame `ModuleShell`.
- Other modules: none. The report form links to Docs' emergency plans by URL for people with `docs.read`.
