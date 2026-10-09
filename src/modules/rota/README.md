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
- Menu entry, levels and permissions: still in `src/modules/registry.ts` (ADR 0004).

## Permissions
- `rota.view`, `rota.plan`, `rota.manage`.

## Depends on
- Platform: auth and the session, permissions, audit, the database client, the format helpers, the staff notifications (`notifyShiftChange`), home cards and the person file.
- The composition root `src/modules/server.ts` for the swim school's classes (`commitmentsFor`, `planCommitment`; reported by the boundary lint until `src/app/modules.ts` replaces it, ADR 0004).
- The shared workspace frame `ModuleShell`.
- Other modules: none directly.
