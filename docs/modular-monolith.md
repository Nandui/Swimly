# Turnfin as a modular monolith

*Audit and plan, 9 October 2026 (owner request: "change this codebase to be a modular monolith"). The rules that hold today are in [architecture.md](architecture.md); this page says how far the code is from the target and the order of the work.*

Turnfin stays **one Next.js app, one deploy and one main database**. A modular monolith keeps that and makes every module a sealed part with one front door: it owns its code, its tables and its tests, talks to Core and to other modules only through named seams, and lint refuses anything else. That is already what the pillars promise ("a new module is one new folder", "modules never import each other, and lint refuses it"); this plan makes the code match them.

## Where the code is today

| Area | Today | Gap |
| --- | --- | --- |
| Module list | `src/modules/registry.ts` describes every module, its levels and permissions. | None. |
| Seams | `src/modules/contributions.ts` (site summaries, home cards, personal file, commitments, area renames), session hooks and two composition roots. | None; the seams are good and get reused below. |
| Swim school (Activities) | Lives in `src/modules/activities`; lint stops it importing Work modules or querying Core tables. | Already the target shape. |
| Work modules (Docs, Refunds, Training, HR, Rota, Purchasing, Academy, Tasks) | Spread over `src/lib/<id>`, `src/components/<id>` and `src/app/<id>`. | **Lint did not stop them importing each other** or querying each other's tables. Not one folder per module. |
| Imports between modules | 4 leaks: HR used Docs' database check, Refunds and the root layout imported Docs' stylesheets, Rota imported Turnfin Me's daily digest (which itself reads every module). | Fixed in phase 1. |
| Tables between modules | HR's export read Training's assignments; Turnfin Me's digest read Training's and Docs' records directly. | Fixed in phase 1. |
| Core tables from Work modules | About 110 direct queries of `User`, `Club`, `Qualification` and other Core tables across the eight Work modules (Rota 30, Training 22, Tasks 16, HR 13, Academy 11, Purchasing 7, Refunds 7, Docs 5), and about 45 joins to them. | The swim school already reads Core only through `src/lib/directory.ts`; the Work modules do not. Phase 4. |
| Front door | Any file may import any file of a module it is allowed to use. Turnfin Me's API and the composition roots import module internals. | Phase 3. |
| Schema | Split by owner in `prisma/schema/*.prisma`; Refunds, Training and Rota shared `work.prisma`. Core's `User`, `Club` and others carry back-relations to every module's tables. | Split done in phase 1. Back-relations are a Prisma requirement; see "Not planned" below. |

## The target

- **One folder per module**: `src/modules/<id>/` holds its `lib/`, `components/`, `contributions.ts` and tests. Routes stay in `src/app/<route>` because Next.js routes by folder, but a route file only imports its own module and Core.
- **One front door**: `src/modules/<id>/index.ts` (server) is all that composition roots, Turnfin Me's API and the module's own routes see from outside. Everything else in the folder is private, and lint says so.
- **Own data**: each module owns `prisma/schema/<id>.prisma` (Docs and HR keep their own databases). It queries only its own tables, reads people and sites through Core (`src/lib/directory.ts` and Core functions), and never joins Core tables.
- **Core stays where it is** (`src/lib`, `src/components`, `src/app/(core)`): people, roles, sites, audit, policy, the registry and the shared plumbing. Core imports no module.
- **Seams only**: modules meet through `src/modules/contributions.ts`, session hooks, links by URL and the composition roots (`src/modules/server.ts`, `src/modules/session-hooks.ts`, and Turnfin Me's `src/lib/staff-api/records.ts` and `reminders.ts`).

## Phases

Each phase keeps behaviour the same, passes `npm run typecheck`, `npm run lint` and `npm test`, and ships as its own PR. No phase changes the database.

1. **Every module has a boundary** (this PR). Lint now gives every Work module the rules the swim school already had: no imports from another module (by alias and by resolved path, so relative imports are caught), and no queries of another module's tables, with table ownership read from the `prisma/schema` file names. `work.prisma` is split into `refunds.prisma`, `training.prisma` and `rota.prisma` (an empty migration). The four import leaks and two table leaks are fixed: the Docs shell stylesheets and the Poolside theme move to `src/app/theme`, `databaseIdentity` moves to Core, shift-change emails move to `staff-api/notify.ts`, Training and Docs each provide their own digest items, and HR's export gets Training's records through a new `subjectRecords` seam.
2. **One folder per module.** Move each Work module's `lib` and `components` into `src/modules/<id>/`, one module per PR, smallest first: Refunds, Purchasing, Academy, Tasks, Training, Docs, HR, Rota. Pure moves and import rewrites. The Docs shell pieces that Refunds, Training, HR and Rota borrow move to `src/components/workspace` first.
3. **One front door.** Add `index.ts` to each module, point the composition roots, Turnfin Me's API and routes at it, and lint deep imports into another module's folder.
4. **Core through Core.** Work modules stop querying and joining Core tables: extend `src/lib/directory.ts` (qualifications, departments, roles, managers) and apply the swim school's join rule to every module. Done module by module, with each module's tests.
5. **Core tidy-up.** One date helper (Tasks and Rota each keep their own `addDays`), the email code check and rate limit move into Core as already planned, and each module's registry entry moves into its own folder.

## Not planned without an owner decision

- **Dropping cross-module foreign keys** (and with them Core's back-relations in Prisma). It would let a module's schema change without touching `core.prisma`, but removing a foreign key is not an additive change.
- **Separate deployable services.** A modular monolith keeps one deploy; the seams are written so a module could move out later (the swim school did, briefly, on 28 September and came back).
