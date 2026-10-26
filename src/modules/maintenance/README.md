# Maintenance

**Purpose:** follows what is broken at each site from the first report until it is fixed.

Its levels are in [docs/apps.md](../../../docs/apps.md); the decision to add it is D14 in [docs/decisions.md](../../../docs/decisions.md). LeisureWorld's maintenance team works in **Trackplan**, their own tool. Turnfin never talks to Trackplan: it records only what staff type, namely whether a problem is already in Trackplan and, optionally, its Trackplan reference.

## Features
- `report`: the report form (`/maintenance/new`). Staff give the site, area and exactly where, what is broken, urgency, and whether it is out of use or could hurt someone ("Could hurt someone" makes it Urgent). They also answer "Is it already in Trackplan?" (Yes, No or Not sure, with an optional reference) and can add up to three photos. The form lists the open requests in the chosen area first, so a problem is not reported twice.
- `photos`: adding photos to an open request (the reporter to their own, Manage to any at the site) and opening them (`/api/maintenance/photos`, `/api/maintenance/photos/[id]`). Checked by the platform's file check (`src/lib/files`).
- `requests`: the lists (`/maintenance`: open, to put in Trackplan, yours, closed) and one request's page (`/maintenance/[id]`). Manage's moves happen on that page: put it in Trackplan, mark it fixed, close it not fixed (with a reason, or as a duplicate of another request), open it again, and correct its details. This feature also gives the Home and starter-page items and the subject access records.
- `workspace`: the frame, its one page list (`pages.ts`) and the starter page `/maintenance/overview`.

`shared/` holds what two or more features use: statuses, urgencies, risks and Trackplan answers (`types.ts`), the pure rules (`rules.ts`, tested in `rules.test.ts`), the access check (`access.ts`) and the locked, audited write (`service.ts`).

## Front door (index.ts)
- `MAINTENANCE_STATUS_META`, `MAINTENANCE_URGENCY_META`: each status's and urgency's label, tone and icon. Used by Core's status-metadata test.

Nothing else in Turnfin calls into Maintenance. Routes use the feature entries.

## Data owned
Declared in `prisma/schema/maintenance.prisma`, migration `20261209090000_maintenance` (new tables only):
- `MaintenanceRequest` (`maintenance_requests`): one problem at one site. It holds where it is, what is broken, urgency, risk, the Trackplan answer and reference, status, and how it was closed.
- `MaintenanceEvent` (`maintenance_events`): the request's history, one row per step, with the note given.
- `MaintenancePhoto` (`maintenance_photos`): photos, stored as bytes. A removed photo is hidden, never deleted.

## Events
- Emits: none. Emailing the site's managers about urgent requests waits for the platform's email outbox (roadmap step 4).
- Listens to: none.

## Registration (module.ts)
- Home and starter-page items (`registerHomeCard`). For Manage: "To put in Trackplan" and "Urgent and open". For everyone: "Report a maintenance problem", and, on the starter page only, "Your open requests".
- Subject access records `maintenance` (`registerSubjectRecords`): the requests a person reported.
- Area renames (`registerAreaRename`): requests keep the area's name, so a rename reaches them.
- Menu entry, levels and permissions: `manifest.ts`, listed in `src/app/modules.ts`.

## Permissions
- `maintenance.report`: report at their sites and see every request there.
- `maintenance.manage`: put requests in Trackplan, correct, close and reopen them at their sites. Includes reporting.

## Depends on
- Platform: the policy engine (`sitesFor`, `mayFor`), audit, the file check (`src/lib/files`), the database client, home cards, subject records and area renames (`src/modules/contributions`).
- Core reads (never Core tables): sites and areas through `src/lib/directory.ts`.
- Other apps: none.
