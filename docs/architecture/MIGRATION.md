# Migration to modular architecture

**Status:** Phase 0: audit done, module map awaiting Fernando's approval. Parts of phases 1 to 4 were already done under the earlier plan in [../modular-monolith.md](../modular-monolith.md) (PRs #8 and #9, 9 October 2026).
**Next step:** Fernando approves (or changes) the module map below, and decides the open questions. No refactoring starts before that.

## Phases
- [x] Phase 0 — Audit written: [../modular-monolith.md](../modular-monolith.md) holds it (to be copied to `docs/architecture/audit.md` in this file's shape once the map is approved)
- [ ] Phase 0 — Module map approved by user
- [ ] Phase 1 — Scaffold folders, registry, event bus, aliases
  - [x] `src/modules/` exists; the module registry is `src/modules/registry.ts`
  - [ ] `src/platform/`, `src/ui/`, `src/front/`, `src/app/modules.ts`
  - [ ] Typed in-process event bus (today modules meet through `src/modules/contributions.ts` and composition roots)
- [x] Phase 1 — Boundary lint added (already at error, not warning: `eslint.config.mjs`, custom `no-restricted-imports` and `import/no-restricted-paths` rules, not `eslint-plugin-boundaries`)
- [ ] Phase 2 — Modules moved (list each below as it's done)
- [ ] Phase 3 — Data ownership documented, cross-module table access removed
  - [x] No module queries another module's tables (lint, PR #8)
  - [ ] Work modules still query Core tables directly (about 110 places); table ownership not yet in module READMEs
- [ ] Phase 4 — Boundary lint switched to error and proven (error and proven with probe files for the current rules; not yet for the section 3 table)
- [ ] Phase 4 — Docs finalised

## Modules moved
Moved into `src/modules/<id>/{lib,components}` (PR #9), not yet into the `features/` shape, and without `index.ts`, `module.ts` or `README.md`:
- refunds, purchasing, academy, tasks, training, docs, hr, rota
- activities (the swim school) was already there

## Proposed module map (awaiting approval)
- **Platform** (today "Core", `src/lib`): sign-in and sessions, people, roles and levels, permissions and the policy engine, sites, audit log, email, public-API kit, database clients, devices. Open question below: sites, departments and qualifications carry business terms.
- **UI** (today `src/components/shadcn`, `src/components/ui`, `src/components/ui-kit`, the theme in `src/app/theme`).
- **Modules**: activities (swim school and pool deck), refunds, purchasing, academy, tasks, training, docs, hr, rota. Admin screens stay with the platform.
- **Front** (today Core pages that combine modules): the home page and its cards, Sites summaries, the HR personal file, Turnfin Me's API (`src/lib/staff-api`).
- Today's seams as events or calls: commitments and `planCommitment` (Rota asks the swim school: call), shift-change emails (event), personal file and subject records (call from HR/front), home cards and site summaries (front reads module APIs).

## Awaiting user decision
- Approve or change the module map above (CLAUDE.md, Step 4).
- Table prefixes (`hr_`, `rota_`): renaming tables is not an additive change. AGENTS.md says schema changes only add, so this needs a decision.
- `src/ui` versus `src/components/shadcn`: AGENTS.md and DESIGN.md name `src/components/shadcn`. Moving it means updating both.
- Core holds business terms (sites, departments, qualifications) that this file's platform rule forbids: keep them as a "core" module, or as platform with an ADR.
- Docs location: the architecture docs live in `docs/architecture.md` and `docs/modular-monolith.md`. Move them under `docs/architecture/`?

## Log
- 2026-10-09 — PR #8: lint boundaries for every module, `work.prisma` split, cross-module leaks fixed.
- 2026-10-09 — PR #9: each Work module moved into `src/modules/<id>`.
- 2026-10-09 — Architecture rules added as CLAUDE.md; this tracker created. Stopped for Fernando's review.
