# Tasks

**Purpose:** makes sure each site's daily, weekly and one-off checks are done, on time, with evidence.

The rules for templates, schedules, scores and follow-ups are in [docs/tasks.md](../../../docs/tasks.md).

## Features
- `day` — a site's day: its tasks, doing one (checklist, readings, files), can't-complete and not-applicable, approving and reopening, comments, adding one by hand (`/tasks`, `/tasks/[id]`), and the home-page counts.
- `follow-ups` — follow-up actions raised from a task or on their own, resolved and reopened (`/tasks/actions`).
- `templates` — what a task asks for and when it repeats (`/tasks/templates`, `/tasks/templates/new`, `/tasks/templates/[id]`).
- `sites` — each site's task settings: status, hours, time zone and closed days (`/tasks/sites`, and from the day).
- `reports` — scores and completion reports with their CSV, the activity log and the JSON export (`/tasks/reports`, `/tasks/activity`, `/tasks/export.json`).
- `schedule` — the nightly cron that makes the coming days' tasks and freezes yesterday's scores (`/api/cron/tasks`).
- `workspace` — the Tasks frame, its menu, the site list and the open-action count (`src/app/tasks/layout.tsx`).

`shared/` holds what two or more features use: the pure rules (`rules.ts`, tested in `rules.test.ts`), the access check (`access.ts`), reads that make and shape a day's tasks (`data.ts`), what the writes share (`writes.ts`), the status tag and the dialogs' kit.

## Public API (index.ts)
- None. Nothing outside Tasks calls into it; routes use the feature entries.

## Data owned
Declared in `prisma/schema/tasks.prisma` (table names kept, ADR 0002):
- `TaskTemplate` — what a task asks for and its schedules.
- `Task` — one task on one day at one site, with its answers.
- `TaskComment`, `TaskFile` — comments and evidence on a task.
- `TaskAction` — follow-up actions.
- `TaskSite` — each site's task settings.
- `TaskScoreSnapshot` — frozen daily scores.

Tasks also reads Core's `Club`, `StaffRole` and `User` directly (sites, roles a task is aimed at, the person's role). Moving those reads onto Core functions is phase 3 of [MIGRATION.md](../../../docs/architecture/MIGRATION.md).

## Events
- Emits: none.
- Listens to: none.

## Registration (module.ts)
- Home card: tasks to do today, overdue, to approve, completed with readings out of range, open follow-ups.
- Menu entry, levels and permissions: `manifest.ts`, listed in `src/app/modules.ts`.

## Permissions
- `tasks.complete`, `tasks.review`, `tasks.manage`.

## Depends on
- Platform: the policy engine, audit, the database client, home cards (`src/modules/contributions`).
- Core reads (never Core tables; enforced by the boundary lint): sites and roles through `src/lib/directory.ts` (`liveSitesWithin`, `liveSitesByOrganisation`, `withSite`, `siteName`, `rolesByIds`, `allRoles`, `staffRoleIdOf`); its activity screen through `moduleAuditTrail` in `src/lib/audit.ts`.
- The UI kit's workspace frame `ModuleShell` (`src/components/ui/module-shell.tsx`) and the UI kit's site switcher (`src/components/ui/site-switcher.tsx`).
- Other modules: none.

## Known gaps
- `src/app/tasks/files/[id]/route.ts` reads `TaskFile` itself rather than through a feature; it moves into `day` when that route is next changed.
