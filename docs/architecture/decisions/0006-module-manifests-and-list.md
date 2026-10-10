# 0006: Each module's description lives in its manifest.ts, listed once in src/app/modules.ts

**Status:** Proposed (10 October 2026, lean refactor; accepted when Fernando merges the PR).

## Context
CLAUDE.md section 5 has each module register itself through `module.ts`, listed once in `src/app/modules.ts`. Until now every module's description (name, menu entry, levels, permissions) sat in Core's `src/modules/registry.ts` as `registerModule` calls, and each module's `module.ts` registered only its server contributions (home cards, commitments, person-file sections). Those `module.ts` files are `server-only`, because they import the module's data code, but the descriptions are read in the browser too: the role editor and the module bar build from them.

## Decision
Split the plug in two, by where it runs:
- `src/modules/<id>/manifest.ts` exports the module's description (`ModuleManifest`). It imports only icons and types, so it is safe in the browser. Activities exports two, Swim school and Pool deck.
- `src/app/modules.ts` is the one list of modules, in the order lists show them within a group. Core's registry reads it and adds Admin, which is Core's own description.
- `module.ts` stays the server plug, loaded by the composition root `src/modules/server.ts`.

## Consequences
Adding a module means a folder with `manifest.ts` and `module.ts`, one line in `src/app/modules.ts` and one in `src/modules/server.ts`; Core's registry is not edited. `src/app/modules.ts` is a composition root in the boundary lint, so Core's registry may read it. ADR 0004 is complete.
