# Migration to modular architecture

**Status:** Phase 2 in progress. Module map and ADRs 0001 to 0003 approved 9 October 2026.
**Next step:** Phase 2: give each module `index.ts`, `module.ts`, `README.md` and the `features/` shape, starting with Refunds.

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
- [ ] Phase 2 — Modules moved (list each below as it's done)
- [ ] Phase 3 — Data ownership documented, cross-module table access removed
  - [x] No module queries another module's tables (lint, PR #8)
  - [ ] Work modules still query Core tables directly (about 110 places); table ownership not yet in module READMEs
- [ ] Phase 4 — Boundary lint switched to error and proven
- [ ] Phase 4 — Docs finalised

## Modules moved
Moved into `src/modules/<id>/{lib,components}` (PR #9); not yet in the `features/` shape, and without `index.ts`, `module.ts` or `README.md`:
- refunds, purchasing, academy, tasks, training, docs, hr, rota
- activities (the swim school) was already there

## Awaiting user decision
- (none)

## Log
- 2026-10-09 — PR #8: lint boundaries for every module, `work.prisma` split, cross-module leaks fixed.
- 2026-10-09 — PR #9: each Work module moved into `src/modules/<id>`.
- 2026-10-09 — Architecture rules added as CLAUDE.md; this tracker created.
- 2026-10-09 — Module map approved. Phase 1: event bus, boundary lint in warning mode, docs/architecture (README, audit, events, ADRs 0001 to 0004).
- 2026-10-09 — Fernando confirmed ADRs 0001 to 0003 (Core is the platform, table names kept, UI kit stays in `src/components`).
