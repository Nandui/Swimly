# Rota

**Purpose:** plans who works where at each site, day by day.

See [docs/rota.md](../../../docs/rota.md).

## Features
- `plan` — planning the week: shifts, activities, breaks, who can fill a gap, copying and sharing a week (`/rota`).
- `today` — running today: who is on, the gaps left, the day's note and timepoints (`/rota/today`).
- `bookings` — repeating bookings of areas (`/rota/bookings`).
- `absences` — reporting absences, extending them and recording returns to work (`/rota/absences`).
- `me` — a person's own days, for Turnfin Me. Reached through `index.ts`.
- `person-file` — the rota's parts of a person's file: planned days, absences and changes to their activities.
- `workspace` — the Rota frame, its menu, overview and the access check (`src/app/rota/layout.tsx`, `/rota/overview`).

`shared/` holds what two or more features use: the access check, constants and status metadata, shift and cover rules, the day model, site and activity reads (`data.ts`), the plan and fill actions used by Plan and Today (`actions.ts`), write helpers (`writes.ts`), the area rename and the plan dialogs, fill sheet and change fields.

## Public API (index.ts)
- `myDays(userId, days?)` — a person's own days ahead, with their shifts, activities and classes.
- `MyDay` — one of those days.

## Data owned
- `RotaNeed`, `RotaAssignment` — activities planned and who covers them.
- `RotaPlanShift`, `RotaBreak` — planned shifts and breaks.
- `RotaRepeat` — repeating bookings of areas.
- `RotaAbsence`, `RotaAbsenceUpdate` — absences and returns to work.
- `RotaDayNote`, `RotaWeekShare`, `RotaLog` — the day's note, shared weeks and the change log.
- The retired rota's tables (`RotaShift`, `RotaShiftSegment`, `RotaShiftChange`, `RotaActivity`, `RotaBooking`, `RotaBookingNeed`, `RotaPerson`, `RotaDepartment`, `RotaImport`, `RotaChange`) are no longer read; they stay until one migration removes them (docs/rota.md).

Rota still reads Core's people, sites, departments, activity types and qualifications with Prisma (ADR 0001 puts them in the platform).

## Events
- Emits: none.
- Listens to: none.

## Registration (module.ts)
- Home card: who is on today and the gaps; for Run, who is off, reporting an absence and returns to work to record.
- Person file: planned days, absences and returns, changes to their activities.
- Area rename: activities, repeats and bookings follow an area renamed in Admin.
- Menu entry, levels and permissions: `manifest.ts`, listed in `src/app/modules.ts`.

## Permissions
- `rota.view`, `rota.plan`, `rota.manage`.

## Depends on
- Platform: auth and the session, permissions, audit, the database client, the format helpers, the staff notifications (`notifyShiftChange`), home cards and the person file.
- Core reads (never Core tables; enforced by the boundary lint): the activity list through `src/lib/setup/activity-types.ts`; people, ages (young-worker rules only), departments and sites through `src/lib/directory.ts`; held qualifications through `src/lib/qualifications.ts`.
- Core's contributions registry (`src/modules/contributions.ts`: `commitmentsFor`, `planCommitment`) for the swim school's classes and Academy's sessions; it loads every module's registrations itself.
- The UI kit's workspace frame `ModuleShell` (`src/components/ui/module-shell.tsx`), `AreaSelect` and the UI kit's site switcher (`src/components/ui/site-switcher.tsx`).
- Other modules: none directly.
