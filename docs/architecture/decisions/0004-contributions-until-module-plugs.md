# 0004: Contributions stand in for module plugs until each module moves

**Status:** Accepted (9 October 2026).

## Context
CLAUDE.md wants each module to register through `module.ts` listed in `src/app/modules.ts`, and to talk through `index.ts` or events. Today modules register home cards, site summaries, personal-file sections and commitments through `src/modules/contributions.ts`, wired in `src/modules/server.ts`, and describe their levels in `src/modules/registry.ts`.

## Decision
Keep these seams working while each module gets its `index.ts`, `module.ts` and `features/` shape (migration phase 2). Each module's registrations move into its `module.ts` as it moves; `src/modules/server.ts` becomes `src/app/modules.ts` when the last one has.

## Consequences
The boundary lint reports module imports of `@/modules/server` as warnings until then.
