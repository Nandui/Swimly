# Architecture: Core and modules, one app

*Owner decisions, 28 September 2026. What Turnfin is, in five sentences, is in [how-turnfin-works.md](how-turnfin-works.md), along with the pillars every change is judged against.*

Turnfin is **one Next.js app** made of **modules** on a shared **Core**, plus **Turnfin Me** (`apps/me`), a separate phone app that only calls the staff API.

| Part | What it is | Where it lives |
| --- | --- | --- |
| **Core** | What every module shares: sign-in, people, roles, sites (`Club`), departments and qualifications, the audit log, the module catalogue and the home page. | `src/app/(core)`, `src/lib/{staff,policy,people,clubs,devices,email,audit,directory,...}`, `src/modules/{registry,contributions}.ts` |
| **Swim school** (Activities) | Running what the centre sells. Swim school is the first activity type: office (curriculum set-up), desk (enrolments, moves, waitlists, assessments), deck (attendance, competencies) and the parent API. | `src/app/(activities)`, `src/app/(instructor)`, the parent and operations APIs, and `src/modules/activities/{lib,components}` |
| **Work modules** | Refunds, Docs, Training, Rota and HR. | `src/app/{refunds,docs,training,rota,hr}`, `src/lib/<module>`, `src/components/<module>` |

## Every module describes itself

`src/modules/registry.ts` holds one description for each module:
- its name, icon and link;
- its **levels** (None, then for example Use and Manage), each with one plain sentence, the permissions it gives, and where it applies;
- up to two **extras** across the app (Docs "Can approve", Swim school "Can cancel classes");
- its **log name**.

A role holds one level for each module (`StaffRole.levels`). `src/lib/staff/levels.ts` translates levels into the named permissions that pages and actions check, so no check ever asks for a level or a role name. A screen is a menu entry that appears when its one permission is held (`src/lib/staff/screens.ts`), and a module appears on the home page when the person holds any of its permissions. Adding a module means adding a folder and one description. A test fails if any permission is not given by exactly one level.

## The rules

1. **Core never imports a module.** Modules import Core; Core does not import them.
2. **The swim school depends on Core only**, never on a Work module (Docs, Refunds, Training, HR, Rota).
3. **Cross-module needs go through a seam**, never a direct import:
   - **Contributions** (`src/modules/contributions.ts`): a module registers read-only summaries that Core pages show. The swim school adds the Staff page's *Classes* column and each site's *programmes · swimmers · classes* line on Sites (`/clubs`). Rota adds *Absences and returns to work* to a person's personal file (the HR record and its export). **Commitments** (who is busy when): the swim school reports each class, its time and who teaches it that day (`activities.classes`), so Rota shows the day's classes on its plan and warns when someone on a duty is teaching then, without importing the swim school.
   - **Session hooks** (`src/modules/session-hooks.ts`): per-request work a module needs. The swim school applies due scheduled unenrolments before any read. `requireSession` loads the hook file lazily.
   - **Self-registration**: shared UI can be extended by a module without knowing it. For example, the swimmer picker declares itself with `labelsItself` from `form-dialog`.
   - **Links**: one module links to another's screens by URL, never by importing them. The Reception Portal's *Add a swimmer* task opens `/students?add=1`.
4. **Composition roots are the only files that import every module**: `src/modules/server.ts` and `src/modules/session-hooks.ts`.
5. **Screens belong to exactly one part.** `CORE_SCREENS`, `ACTIVITIES_SCREENS` and `WORK_MODULE_SCREENS` in `src/lib/staff/screens.ts` are explicit lists, and a test fails if a screen is not in exactly one of them.
6. **Data belongs to one part.** `prisma/schema/{base,core,work,activities}.prisma` says which part owns each table. The swim school never queries Core tables or joins `User`/`Club`: it stores ids and adds names with `src/lib/directory.ts` (`withStaff`, `withSites`, `staffByIds`, `liveSiteIds`, ...). Core and Work modules never query swim-school tables.

`npm run lint` enforces rules 1, 2, 4 and 6 with `no-restricted-imports` and `no-restricted-syntax` (see `eslint.config.mjs`). Tests and `src/test` are exempt, because they exercise routes end to end.

## Databases

- **Main database** (`DATABASE_URL`): Core, the swim school and the Work modules except Docs and HR. `dev` should get its own; see [database-operations.md](database-operations.md#a-separate-database-for-dev). `src/lib/database-environment.ts` stops a `dev` deployment migrating production.
- **Docs** (`DOCS_DATABASE_URL`) and **HR** (`HR_DATABASE_URL`) have their own databases.
- Schema changes only ever add.

## Activity types

`src/modules/activities/types.ts` defines `ACTIVITY_TYPES`. Swim school is the only one, with the features `progression`, `assessments`, `parentApp`, `waitlists` and `cover`. To add a second type, give `Programme` an additive `activityType` column (default `"swim-school"`), register the type, and make screens ask `hasFeature` instead of assuming levels and competencies exist.

## Running locally

- `npm run dev` starts the app on port 3000.
- `npm run sandbox` starts it on port 3100 against a throwaway database with fictional data.

## History

On 28 September 2026 the swim school briefly ran as a second Next.js app (`apps/activities`) behind the first, and a separate Activities database was planned. Both were reversed the same day in favour of simplicity: one app, one main database. The module boundaries and their lint rules stayed.

## Known follow-ups

- Refunds, Training, HR and Rota still borrow the Docs shell pieces (`components/docs/{primitives,ui}` and the Docs stylesheets; the fin is drawn by `ModuleShell` and the sign-in `AuthFrame`). They should move to `components/workspace` so Work modules stop depending on Docs.
- HR reads Docs' storage configuration (`lib/hr/storage-config.ts` imports `lib/docs/storage-config`); a Core storage helper would remove it.
- `AuditLog.programmeId` is swim-school-shaped; a module-neutral `module` column is planned.
