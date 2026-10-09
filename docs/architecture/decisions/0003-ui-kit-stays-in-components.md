# 0003: The UI kit stays in src/components for now

**Status:** Accepted (9 October 2026, confirmed by Fernando).

## Context
CLAUDE.md puts the UI kit in `src/ui`. AGENTS.md, DESIGN.md and `components.json` (shadcn) name `src/components/shadcn`, `src/components/ui` and `src/components/ui-kit`.

## Decision
Keep the folders where they are; the boundary lint treats them as the UI layer. Move them to `src/ui` later in one change that also updates AGENTS.md, DESIGN.md and `components.json`.

## Consequences
No churn for the design system now; one known difference from the target folder layout.
