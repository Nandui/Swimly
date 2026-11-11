# Plan (test)

**Purpose:** plans who works when at each site, on which duties.

Its levels are in [docs/apps.md](../../../docs/apps.md#plan-test); why it exists is [D17](../../../docs/decisions.md). It runs on test beside Rota, which stays as it is.

## Features
- `week` — the Week (`/plan`): one department's people across Monday to Sunday, adding and changing shifts, copying last week (`copyLastWeek`).
- `day` — the Day (`/plan/day`): what's on area by area (one row per area, one block per session or class) with what still needs someone and who could fill it, each person's shift with duties, breaks, classes and free time, the warnings and the tasks given that day, for every department or the one picked (`?dept=`, which narrows the people only); putting people on a duty with the tasks they do and the time for each, changing those and taking people off (`saveBlock`, `removeBlock`), choosing class teachers (`planClassTeacher`), and changing one day of a session (`setSessionDay`).
- `off` — Off (`/plan/off`): marking people off and taking it back (`markOff`, `withdrawOff`).
- `setup` — Setup (`/plan/setup`): duties with the names of the tasks each can come with (who does which, and at what time, is chosen on the Day), and what's on with the duties it needs (`saveDuty`, `saveSession` and their retire actions). It shows the site's areas from Admin › Areas, where they are kept.
- `workspace` — the frame, its one page list (`pages.ts`, for the page bar and the starter page `/plan/overview`), the site picker and the access check (`src/app/plan/layout.tsx`).

`shared/` holds the pure day model (`model.ts`: sessions on a day, needs that stack, fills and gaps, warnings, lane clashes, tasks, who could fill a gap, copying a week), the rules and form schemas (`rules.ts`), the access check (`access.ts`), where a person may plan (`scope.ts`), the reads the Week and Day share (`data.ts`), the shift writes they share (`actions.ts`) and the shift dialog and form fields.

## Front door (index.ts)
- `OFF_REASON_META`, for Core's tone check. No other app asks Plan anything while it is on test.

## Data owned
Declared in `prisma/schema/plan.prisma`:
- `plan_areas` (`PlanArea`) — retired: no longer read; areas are Admin › Areas. Waits for the owner's yes to be removed, with `plan_sessions.areaId`.
- `plan_duties`, `plan_duty_tasks` (`PlanDuty`, `PlanDutyTask`) — what people do in a shift, and the tasks each can come with (a task's `when` and `atMinutes` are retired: no longer read, waiting for the owner's yes to be removed).
- `plan_sessions`, `plan_session_needs`, `plan_session_days` (`PlanSession`, `PlanSessionNeed`, `PlanSessionDay`) — what's on (its Admin area in `siteAreaId`), the duties it needs, and single days changed or called off.
- `plan_shifts`, `plan_blocks` (`PlanShift`, `PlanBlock`) — shifts and the duty blocks in them, each with the duty's tasks chosen for it and their times (`taskIds`, `taskMinutes`).
- `plan_offs` (`PlanOff`) — people marked off.

No relations to Core tables: sites, departments, people and qualifications are read through Core's functions. Nothing is read from Rota's tables.

## Events
- Emits: none.
- Listens to: none.

## Registration (module.ts)
- Nothing yet: no home card, person file or Turnfin Me while it is on test.
- Menu entry, levels and permissions: `manifest.ts`, listed in `src/app/modules.ts`.

## Permissions
- `plan.view`, `plan.plan`, `plan.manage`.

## Depends on
- Platform: the policy engine, audit, the database client and the format helpers.
- Core reads (never Core tables): sites, areas (`areasAt`, `areaById`), departments and people through `src/lib/directory.ts`; qualifications through `src/lib/qualifications.ts`.
- Core's contributions registry (`src/modules/contributions.ts`: `commitmentsFor`, `planCommitment`) for Swim school's classes and Academy's sessions, and to plan a class's teacher.
- The UI kit's workspace frame `ModuleShell`, `SiteSwitcher`, `DayTimeline` and `Inspector`.
- Other modules: none directly.
