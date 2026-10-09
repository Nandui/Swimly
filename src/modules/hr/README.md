# HR

**Purpose:** keeps each person's HR record (notes and performance reviews) private to the people allowed to see it.

HR keeps its records in its own database (`HR_DATABASE_URL`, migrations in `hr-database/migrations`); unset, HR stays switched off. See [docs/hr.md](../../../docs/hr.md).

## Features
- `team` — the people this person may see in HR, with their latest review (`/hr`).
- `person` — one person's HR file: notes (add, withdraw), reviews and details (`/hr/people/[id]`).
- `reviews` — performance reviews: start, write, share and see one (`/hr/reviews/[id]`, started from a person's file).
- `activity` — who opened which HR records, and when (`/hr/activity`).
- `export` — a person's HR records as one download for subject access (`/hr/people/[id]/export`).
- `details-requests` — details changes sent from Turnfin Me, and their home-page count (`/hr/details-requests`).
- `me` — what HR has shared with a person, for Turnfin Me: notes and reviews, logging that read, acknowledging a review. Reached through `index.ts`.
- `workspace` — the HR frame, its menu and the access check (`src/app/hr/layout.tsx`).

`shared/` holds what two or more features use: the HR database and its configuration, the access check, statuses, the column lists, the access log and the subject check (`records.ts`), write helpers (`writes.ts`) and the dialogs' kit.

## Public API (index.ts)
- `hrConfigured()` — whether the HR database is set up.
- `mySharedHr(userId, orgId)` — notes and reviews shared with a person.
- `logOwnHrRead(me)` — logs a person reading their own record (moved here from the staff API, which used to write HR's `access_events` itself).
- `acknowledgeReviewFor(me, id, comment)` — a person acknowledges a shared review.

## Data owned
In the HR database (not Prisma): `notes`, `reviews`, `access_events`, `audit_events`.

HR's home card counts Core's `StaffDetailChangeRequest`, and a person's file reads Core's people and other modules' records through the `personFile` and `subjectRecords` seams.

## Events
- Emits: none.
- Listens to: none.

## Registration (module.ts)
- Home card: details changes to check.
- Menu entry, levels and permissions: still in `src/modules/registry.ts` (ADR 0004). Only a superadmin gives HR.

## Permissions
- `hr.records.read`, `hr.notes.write`, `hr.reviews.write`, `hr.details.write`.

## Depends on
- Platform: the policy engine (`subjectsFor`, `requireCapFor`), audit, the database client, home cards.
- Core reads (never Core tables; enforced by the boundary lint): staff details, the details editor's options, the subject export's Core record and pending details changes through `src/lib/people/records.ts`; names through `src/lib/directory.ts`.
- The composition root `src/modules/server.ts` for other modules' person-file sections and subject records (reported by the boundary lint until `src/app/modules.ts` replaces it, ADR 0004).
- The shared workspace frame `ModuleShell`.
- Other modules: none directly.
