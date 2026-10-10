# Migration to modular architecture

**Status:** Phases 2 and 3 done in draft PR #11, waiting on review. Module map and ADRs 0001 to 0003 approved 9 October 2026.
**Next step:** Phase 4. Fernando chose to split the frame (10 October 2026): the site switcher is in the UI kit; `ModuleShell` and the account menu go to the platform once the rule exception they need is decided (see below). Then switch the boundary rules to error.

## Phases
- [x] Phase 0 — Audit written to docs/architecture/audit.md (with [../modular-monolith.md](../modular-monolith.md))
- [x] Phase 0 — Module map approved by user (9 October 2026; [README.md](README.md))
- [ ] Phase 1 — Scaffold folders, registry, event bus, aliases
  - [x] Event bus: `src/platform/events` (typed, in-process, failing listeners logged), with a test
  - [x] Aliases: `@/` already resolves `@/platform`, `@/modules/<id>` and, once created, `@/ui` and `@/front`
  - [x] Registry: `src/modules/registry.ts` (moves to `src/platform/registry` with the rest of Core)
  - [ ] `src/app/modules.ts` replaces `src/modules/server.ts` as modules get `module.ts` (ADR 0004)
  - [ ] `src/ui` (ADR 0003) and `src/front` folders: created when code first moves there (rule of two)
- [x] Phase 1 — Boundary lint added (warning mode): `eslint-plugin-boundaries` encodes CLAUDE.md section 3 in `eslint.config.mjs`. 383 warnings on 9 October 2026, most of them routes importing module internals (no module has an `index.ts` yet). Proven: platform → module, ui → platform and module → other module imports are reported. The older error-level rules (no module imports another module or its tables) stay on.
- [x] Phase 2 — Modules moved (list each below as it's done)
- [x] Phase 3 — Data ownership documented, cross-module table access removed
  - [x] No module queries another module's tables (lint, PR #8)
  - [x] Every module reads Core only through Core's functions (`src/lib/directory.ts`, `src/lib/qualifications.ts`, `src/lib/setup/activity-types.ts`, `src/lib/people/records.ts`, `src/lib/audit.ts`, the policy engine); the boundary lint forbids Core table queries and joins in every module, proven with a deliberate violation
  - [x] Each module README lists the tables it owns and the Core reads it uses
  - No tables were renamed or altered and no migrations were run.
- [ ] Phase 4 — Boundary lint switched to error and proven
- [ ] Phase 4 — Docs finalised

## Modules moved
In the full shape (`index.ts`, `module.ts`, `events.ts`, `README.md`, `shared/`, `features/`), routes importing only feature entries:
- refunds (9 October 2026): features `queue`, `request`, `workspace`
- purchasing (9 October 2026): features `orders`, `suppliers`, `workspace`
- academy (9 October 2026): features `courses`, `course-types`, `calls`, `booking`, `workspace`
- tasks (9 October 2026): features `day`, `follow-ups`, `templates`, `sites`, `reports`, `schedule`, `workspace`
- training (9 October 2026): features `courses`, `assignments`, `sign-off`, `certificates`, `expiring`, `me`, `person-file`, `workspace`; Turnfin Me's staff API now uses its `index.ts`
- docs (9 October 2026): features `home`, `library`, `reader`, `editor`, `history`, `work`, `reports`, `admin`, `files`, `import`, `me`, `workspace`; its server actions moved from `src/app/docs/actions.ts` into `shared/actions.ts`; the staff API uses `docsReading()` from its `index.ts`
- hr (9 October 2026): features `team`, `person`, `reviews`, `activity`, `export`, `details-requests`, `me`, `workspace`; the staff API no longer writes HR's `access_events` itself (`logOwnHrRead`)

- rota (9 October 2026): features `plan`, `today`, `bookings`, `absences`, `me`, `person-file`, `workspace`; its person-file sections and area rename now register from `module.ts`; the staff API reads a person's days through `index.ts`

- activities, the swim school (9 October 2026): features `students`, `courses`, `attendance`, `enrolment`, `assessments`, `curriculum`, `cancellations`, `duty`, `schedule`, `today`, `together`, `analytics`, `parents`, `instructor`, `workspace`. About 90 of its 280 files are in `shared/` because the domain is tightly linked; `contributions.ts` became `module.ts`; the composition roots use its `index.ts`.

Known warnings left in moved modules: `ModuleShell` (`src/components/workspace`) is the app frame, not a UI-kit component, so features importing it are reported. Deciding where the frame lives (platform or ui) is a boundary question for Fernando once more modules are moved.

## Awaiting user decision
- `ModuleShell` and the account menu use UI kit components, and CLAUDE.md section 3 forbids platform → ui. Moving them to the platform needs an exception (ADR), or they stay where they are until rewired. Blocks Phase 4.

## Log
- 2026-10-09 — PR #8: lint boundaries for every module, `work.prisma` split, cross-module leaks fixed.
- 2026-10-09 — PR #9: each Work module moved into `src/modules/<id>`.
- 2026-10-09 — Architecture rules added as CLAUDE.md; this tracker created.
- 2026-10-09 — Module map approved. Phase 1: event bus, boundary lint in warning mode, docs/architecture (README, audit, events, ADRs 0001 to 0004).
- 2026-10-09 — Fernando confirmed ADRs 0001 to 0003 (Core is the platform, table names kept, UI kit stays in `src/components`).
- 2026-10-09 — PR #10 merged. Phase 2: Refunds in the features shape; boundary lint now also forbids sibling-feature imports (`feature` and `module-shared` elements). Warnings 383 → 367.
- 2026-10-09 — Phase 2: Purchasing in the features shape (actions and reads split between orders and suppliers).
- 2026-10-09 — Phase 2: Academy in the features shape (dialogs, writes and reads split by feature; the booking API is its own feature).
- 2026-10-09 — Phase 2: Tasks in the features shape. `src/app/tasks/files/[id]/route.ts` still queries `TaskFile` itself (noted in the Tasks README).
- 2026-10-09 — Phase 2: Training in the features shape; the staff API reads it through `index.ts`.
- 2026-10-09 — Phase 2: Docs in the features shape; `src/app/docs/actions.ts` moved into the module; the staff API reads required reading through `docsReading()`.
- 2026-10-09 — Phase 2: HR in the features shape; the staff API's own-record log moved into HR (`logOwnHrRead`).
- 2026-10-09 — Phase 2: Rota in the features shape. Every Work module is done; Activities is next. Warnings 383 → 164.
- 2026-10-09 — Phase 2: the swim school (Activities) in the features shape. Every module is done. Warnings 383 → 31.
- 2026-10-09 — Phase 3: Docs, Refunds, Purchasing, Academy, Tasks, HR, Training and Rota read Core only through its functions. New Core reads: `src/lib/qualifications.ts`, `src/lib/setup/activity-types.ts`, `src/lib/people/records.ts`, `moduleAuditTrail`, and more of `src/lib/directory.ts`. The boundary lint now forbids Core table queries and joins in every module.
- 2026-10-10 — Deleted the unused `move-up.tsx` (Fernando's go-ahead); the swim school's empty `progression` feature went with it.
- 2026-10-10 — Frame split chosen. The site switcher moved to the UI kit (`src/components/ui/site-switcher.tsx`).
