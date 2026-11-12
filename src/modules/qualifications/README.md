# Qualifications

**Purpose:** keeps the qualifications staff hold in date for the people a keeper covers.

Its level is in [docs/apps.md](../../../docs/apps.md); why it exists is [D26](../../../docs/decisions.md). Its pages are at `/staff-qualifications`, because Admin's list of qualification types keeps `/qualifications`.

## Features
- `expiring` — qualifications expired or expiring within 60 days, filtered by site and position, each with the course that renews it and **Assign the course**; and who has never held one their position needs (`/staff-qualifications`).
- `certificates` — checking certificates people upload in Turnfin Me: record or decline, and the file (`/staff-qualifications/certificates`, `/staff-qualifications/certificates/[id]/file`).
- `hours` — in-service hours against what each qualification needs: logging them for others, taking one off, and setting the target (`/staff-qualifications/hours`).
- `me` — a person's own hours for Turnfin Me, and their hours for HR's subject export. Reached through `index.ts` and `module.ts`.
- `workspace` — the frame, its one page list (`pages.ts`, for the page bar and the starter page `/staff-qualifications/overview`) and the access check (`src/app/staff-qualifications/layout.tsx`).

`shared/` holds what two or more features use: the access check (`access.ts`), statuses and the warning window (`constants.ts`), hours rules (`hours.ts`) and reads (`hours-reads.ts`), and the people chooser.

## Front door (index.ts)
- `myHours(userId, orgId)` — a person's own in-service hours, for Turnfin Me's staff API.

## Data owned
Declared in `prisma/schema/qualifications.prisma` (table names kept from Training, so moving them needed no migration):
- `TrainingHours` — in-service hours logged, never deleted (removing one stamps `removedAt`). Rows from before D26 may name the Training session whose register credited them.
- `TrainingHourTarget` — how many hours a qualification needs over how many months.

The qualifications people hold, their types and uploaded certificates are the platform's (`core.prisma`), read and written through `src/lib/qualifications.ts`.

## Events
- Emits: none.
- Listens to: none.

## Registration (module.ts)
- Home items (`registerHomeCard`): certificates to check, qualifications expiring.
- Subject records `inServiceHours` (HR's export).
- Menu entry, level and permission: `manifest.ts`, listed in `src/app/modules.ts`.

## Permissions
- `qualifications.manage` (Keep). Training's Manage counts as Keep (`formerly`).

## Depends on
- Platform: the policy engine (`subjectsFor`, `requireCapFor`), audit, the database client, home cards and subject records; qualifications, their types, position requirements and uploaded certificates through `src/lib/qualifications.ts`; people and sites through `src/lib/directory.ts`.
- Other apps: Training, through the `registerQualificationRenewals` plug, for the course that renews a qualification and assigning it (Training checks `training.assign` itself). With Training switched off, no row offers a course.
