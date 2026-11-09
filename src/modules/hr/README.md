# HR

**Purpose:** keeps each person's HR record (notes, reports and performance reviews) private to the people allowed to see it.

HR keeps its records in its own schema, `turnfin_hr`, in the main database ([D23](../../../docs/decisions.md); plain SQL, migrations in `hr-database/migrations`). Its levels and restrictions are in [docs/apps.md](../../../docs/apps.md).

## Features
- `team` — the people this person may see in HR, with their latest review (`/hr`).
- `person` — one person's HR file: notes of a kind (add, withdraw), reviews and details (`/hr/people/[id]`). Opening it reads the reports waiting for the reader's sites.
- `report` — quick reports (good work or an issue) on the people you manage (`/hr/report`), and their home-page count for the centre managers of the site they came from ([D22](../../../docs/decisions.md)).
- `reviews` — performance reviews: start, write, share and see one (`/hr/reviews/[id]`, started from a person's file).
- `digest` — the daily email of yesterday's reports by person, in full, to the addresses kept in HR > Settings by holders of the "Keeps the daily reports email" tick (`hr.digest.manage`) (`/hr/settings`); sent by `/api/cron/hr` at 07:00 UTC, once a day.
- `activity` — who opened which HR records, and when (`/hr/activity`).
- `export` — a person's HR records as one download for subject access (`/hr/people/[id]/export`).
- `details-requests` — details changes sent from Turnfin Me, and their home-page count (`/hr/details-requests`).
- `me` — what HR has shared with a person, for Turnfin Me: notes and reviews, logging that read, acknowledging a review. Reached through `index.ts`.
- `workspace` — the HR frame, its one page list (`pages.ts`, for the page bar and the starter page `/hr/overview`) and the access check (`src/app/hr/layout.tsx`).

`shared/` holds what two or more features use: the HR database and its configuration, the access check, statuses and note kinds, the reports waiting to be read (`reports.ts`), the column lists, the access log and the subject check (`records.ts`), write helpers (`writes.ts`) and the dialogs' kit.

## Front door (index.ts)
- `hrConfigured()` — whether the database is set up.
- `mySharedHr(userId, orgId)` — notes and reviews shared with a person.
- `logOwnHrRead(me)` — logs a person reading their own record (moved here from the staff API, which used to write HR's `access_events` itself).
- `acknowledgeReviewFor(me, id, comment)` — a person acknowledges a shared review.

## Data owned
In the `turnfin_hr` schema (plain SQL, not Prisma): `notes`, `reviews`, `access_events`, `audit_events`, `settings` (the daily email's addresses), `digest_runs` (each day's email, claimed once, with its outcome), `storage_imports` (the record of the one-time copy from the old HR database, 2 November 2026).

HR's starter-page item counts Core's `StaffDetailChangeRequest`, and a person's file reads Core's people and other modules' records through the `personFile` and `subjectRecords` seams.

## Events
- Emits: none.
- Listens to: none.

## Registration (module.ts)
- Starter page items (`registerHomeCard`; Home counts the ones that need the person): details changes to check, and staff reports to read.
- Menu entry, levels and permissions: `manifest.ts`, listed in `src/app/modules.ts`. Only a superadmin gives HR.

## Permissions
- `hr.reports.write` (no fresh sign-in: it reads nothing), `hr.digest.manage` (the daily reports email's list), `hr.records.read`, `hr.notes.write`, `hr.reviews.write`, `hr.details.write`.

## Depends on
- Platform: the policy engine (`subjectsFor`, `requireCapFor`), audit, the database client, home cards.
- Core reads (never Core tables; enforced by the boundary lint): staff details, the details editor's options, the subject export's Core record and pending details changes through `src/lib/people/records.ts`; names through `src/lib/directory.ts`.
- Core's contributions registry (`src/modules/contributions.ts`: `personFile`, `subjectRecords`) for other modules' person-file sections and subject records; it loads every module's registrations itself.
- The UI kit's workspace frame `ModuleShell` (`src/components/ui/module-shell.tsx`).
- Other modules: none directly.
