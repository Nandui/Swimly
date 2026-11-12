# CCTV log

**Purpose:** records every time CCTV footage is checked.

Its levels are in [docs/apps.md](../../../docs/apps.md).

## Features
- `viewings` — record a viewing, the log, one entry and its notes (`/cctv`, `/cctv/new`, `/cctv/[id]`); the home card.
- `workspace` — the frame, its one page list (`pages.ts`, for the page bar and the starter page `/cctv/overview`) and the access check (`src/app/cctv/layout.tsx`).

`shared/` holds the pure rules (`rules.ts`: reasons, the entry's checks, numbers) and the access check (`access.ts`).

## Front door (index.ts)
- `CCTV_REASON_META`, for Core's tone check.

## Data owned
Declared in `prisma/schema/cctv.prisma`:
- `cctv_viewings` (`CctvViewing`) — one time footage was checked. Never changed or deleted.
- `cctv_viewing_notes` (`CctvViewingNote`) — what was added to an entry later.

No relations to Core tables: sites and staff are read through Core's functions.

## Events
- Emits: none.
- Listens to: none.

## Registration (module.ts)
- Home card (`registerHomeCard`): the quick action Record a CCTV viewing.
- Menu entry, levels and permissions: `manifest.ts`, listed in `src/app/modules.ts`.

## Permissions
- `cctv.record`, `cctv.review`.

## Depends on
- Platform: the policy engine, audit, the database client and home cards (`src/modules/contributions`).
- Core reads (never Core tables): sites through `src/lib/directory.ts` (`liveSiteById`, `liveSitesWithin`, `withSite`, `withSites`).
- The UI kit's workspace frame `ModuleShell` (`src/components/ui`).
- Other modules: none. An incident number links to Incidents' `/incidents/number/[number]` route.
