# Architecture: Core, Work and Aquatics

Owner decision, 28 September 2026: Turnfin is built as a shared **Core** with two kinds of product on top.

| Part | What it is | Where it lives today |
| --- | --- | --- |
| **Core** | The organisation every module shares: sign-in, people, roles and assignments, sites (`Club`), departments and qualifications, the audit log, the module catalogue and the front door. | `src/app/(core)` (Staff, Roles, Clubs, Activity, Account), `src/lib/{staff,policy,people,clubs,devices,email,audit,...}`, `src/modules/{registry,contributions}.ts` |
| **Work modules** | Running the centre's staff: Docs, Refunds, Training, HR and Rota, plus Turnfin Me (`apps/me`) for each person's own records. Refunds is a desk tool on this side; it can link to a customer but never depends on Aquatics. | `src/app/{docs,refunds,training,hr,rota}`, `src/lib/<module>`, `src/components/<module>` |
| **Aquatics** | Running what the centre sells: the swim school, with office (curriculum set-up), desk (enrolments, moves, waitlists, assessments) and deck (attendance, competencies), and its parent API. It is the first of a customer-facing family; camps, pool hire and fitness classes would join it. | `src/app/(aquatics)`, `src/app/(instructor)`, `src/app/api/{parent,parent-admin,curriculum-images,operations}`, `src/modules/aquatics/{lib,components}` |

## The rules

1. **Core never imports a module.** Aquatics and Work modules import Core; Core does not import them.
2. **Aquatics depends on Core only**, never on a Work module (Docs, Refunds, Training, HR, Rota).
3. **Cross-module needs go through a seam**, never a direct import:
   - **Contributions** (`src/modules/contributions.ts`): a module registers read-only summaries that Core pages show. Aquatics adds the Staff page's *Classes* column and each site's *programmes · swimmers · classes* line on Clubs.
   - **Session hooks** (`src/modules/session-hooks.ts`): per-request work a module needs. Aquatics applies due scheduled unenrolments before any read. `requireSession` loads the hook file lazily.
   - **Self-registration**: shared UI can be extended by a module without knowing it. For example, Aquatics' swimmer picker declares itself with `labelsItself` from `form-dialog`.
4. **Composition roots are the only files that import every module**: `src/modules/server.ts` and `src/modules/session-hooks.ts`. The Reception Portal (`src/components/portal/reception-portal.tsx`) is the front desk and composes Aquatics' Add swimmer dialog by design.
5. **Screens belong to exactly one part.** `CORE_SCREENS`, `AQUATICS_SCREENS` and `WORK_MODULE_SCREENS` in `src/lib/staff/screens.ts` are explicit lists, and a test fails if a new screen is not in exactly one of them. Aquatics is no longer "everything that isn't another module".

`npm run lint` enforces rules 1, 2 and 4 with `no-restricted-imports` (see `eslint.config.mjs`). Tests and `src/test` are exempt, because they exercise routes end to end.

## Where Core lives in the UI

Staff, Roles, Clubs, Activity and Account open in the **Core** workspace (the shared `ModuleShell`), not inside the Aquatics desk. Their URLs are unchanged. `/core` opens the first Core screen a person may use, otherwise their Account. The portal shows a Core tile only to people with a Core screen.

The Aquatics site switcher stays in the Aquatics sidebar, because it filters the working timetable. Sites themselves are Core.

## Next stages

Each stage is useful on its own.

- **Stage 0, before anything else:** give `dev` its own database. Today `dev` and production share one, so a `dev` deployment can run against tables production has not migrated yet.
- **Stage 2, separate the data:**
  - Move the Aquatics tables into their own Postgres schema with their own migrations.
  - Reference `User` and `Club` by plain IDs with no cross-schema foreign keys. `User.coursesTaught` and `Club.programmes/students/courses` are the relations to drop.
  - Give `AuditLog` a module-neutral shape (its `programmeId` is Aquatics-shaped), or give Aquatics its own audit table as Docs and HR have.
- **Stage 3, separate the app:**
  - `apps/work`, `apps/aquatics` (office, desk, deck and the parent API), `apps/me`.
  - Shared packages for the Core client and the Poolside Clear UI.
  - Shared sign-in across sibling domains.
  - Contributions become calls to the Aquatics API, and the Reception Portal links to the Aquatics app instead of embedding its dialog.
- **Stage 4, grow:**
  - Generalise Aquatics into Activities (activity type, then session series, then places, waitlists and attendance, with levels and competencies as an optional progression feature).
  - Operator editions: Core plus any chosen modules, including Aquatics alone for a swim school.

## Known follow-ups inside Stage 1

- Refunds, Training, HR and Rota still borrow the Docs shell pieces (`components/docs/{brand,appearance-menu,primitives,ui}` and the Docs stylesheets). These are shared shell parts rather than Docs features, and should move to `components/workspace` so Work modules stop depending on Docs.
- HR reads Docs' storage configuration (`lib/hr/storage-config.ts` imports `lib/docs/storage-config`); a Core storage helper would remove it.
- The Reception Portal preview (`scripts/reception-portal-preview`) still imports `reception.css`, which was removed with the portal's old theme. It fails the same way on `dev`.
