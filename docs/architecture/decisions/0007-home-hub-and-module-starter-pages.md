# 0007: Home is the hub; every module opens on its own starter page

**Status:** Proposed (11 October 2026; accepted when Fernando merges the PR).

## Context
After the migration (ADR 0006) each module described itself in `manifest.ts`, but Home (`/`) was still a cross-module dashboard: the day's timeline, queues, figures and quick actions from every module at once, with the swim school's search and daily pages in its top bar. Only Swim school, Rota and Admin had a starter page; the other modules opened straight on one working page (Refunds on its list, HR on its people search), and their page bars were written inline in each shell. Fernando asked (11 October 2026) for each module to be packaged on its own, with a starter page when it is opened, and for Home to be the page where people open the modules they have access to.

## Decision
- **Home is the hub.** It lists the person's modules under their group headings, each with its description and a "N need you" tag, plus the Turnfin Me note. It shows no module's items itself; it only counts the ones that need the person.
- **Every module opens on its starter page**, the manifest's `href`: the shared `ModuleOverview` shape (quick actions, the day's timeline when the module has one, Today, Waiting for you, Everything in <module>), rendered by `ModuleStart` (`src/components/workspace/module-start.tsx`, front). New starter pages live at `/<module>/overview` (Refunds, Tasks, Training, Academy, HR, Purchasing), as Rota's already did, so no existing address changes. Docs keeps its own overview at `/docs`; Pool deck opens on the deck, whose class list is its starter page and which keeps its own isolated frame.
- **One page list per module.** `features/workspace/pages.ts` returns the module's pages (`ModulePage` in `src/modules/registry.ts`: link, label, icon, one-line description). Its shell builds the page bar from it and its starter page lists it, so the two cannot drift. "Overview" is the first link.
- Routes stay thin: the starter route is one `ModuleStart` call with the module's page list.

## Consequences
A new module adds its starter page by giving `ModuleStart` its page list and pointing its manifest's `href` at it; Core is not edited. Home loads every module's items to count them, as before. The swim school's search and daily pages are no longer on Home; they are in the swim school's own frame. Training's records list (`/training`) is labelled "People" in its bar now that "Overview" is the starter page.
