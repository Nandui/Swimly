# 0005: The app frame lives in the UI kit and is fed by a frame context

**Status:** Accepted (10 October 2026, Fernando chose "Rewire instead").

## Context
Every module's layout renders the same frame: `ModuleShell` (rail, bottom bar, page inset), the account menu and the site switcher. They lived in `src/components/workspace` (front), so features importing them broke the boundary rules. The platform was not a fit either: the frame is built from UI kit components, and CLAUDE.md section 3 forbids platform → ui.

## Decision
The frame moves into the UI kit (`src/components/ui/module-shell.tsx`, `account-menu.tsx`, `site-switcher.tsx`). It knows no module and no auth library: it reads a frame context (`src/components/ui/frame.tsx`) holding the module list, groups, role, site, sign-out and an optional tools slot. The root layout's `YourModulesProvider` (`src/components/workspace/your-modules.tsx`, front) fills it from the module registry, Auth.js and the role preview.

## Consequences
No rule exception. Modules keep rendering `ModuleShell` as before, importing it from the UI kit. A new module appears in the frame through the registry alone. Without the provider the frame renders with no modules and a no-op sign-out.
