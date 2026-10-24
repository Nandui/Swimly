# Coinage

**Purpose:** moves a till's request for coins from the desk to accounts.

The rules for the screens, statuses and emails are in [docs/coinage.md](../../../docs/coinage.md) (ADR 0014). It mirrors Refunds' shape without importing it.

## Features
- `queue` — find, filter and count coinage requests (`/coinage`), and the home card's counts.
- `request` — request coinage, follow it, and for accounts decide it and record the order (`/coinage/new`, `/coinage/[id]`).
- `workspace` — the Coinage frame, its one page list (`pages.ts`, for the page bar and the starter page `/coinage/overview`) and the access check every Coinage page runs (`src/app/coinage/layout.tsx`).

`shared/` holds what two or more features use: the statuses, denominations and next steps (`types.ts`), validation and transitions (`rules.ts`), the access check (`auth.ts`), the locked, audited mutation and who is emailed (`service.ts`) and the visibility rule (`data.ts`).

## Front door (index.ts)
- `coinageStatuses` — each status's label, tone and icon. Used by Core's status-metadata test.

## Data owned
Declared in `prisma/schema/coinage.prisma`:
- `CoinageRequest` — one request: site, who for, needed by, the coins, its status, version and order.
- `CoinageEvent` — the history of every change, each with a snapshot.
- `CoinageNotification` — status emails waiting to be sent, sent or failed.

## Events
- Emits: none.
- Listens to: none.

## Registration (module.ts)
- Home items (`registerHomeCard`): requests to decide, approved coinage to order, requests sent back, and "Request coinage".
- Menu entry, levels and permissions: `manifest.ts`, listed in `src/app/modules.ts`.

## Permissions
- `coinage.read`, `coinage.request`, `coinage.review`, `coinage.process` (named like Refunds', so accounts get the same pair in both).

## Depends on
- Platform: auth (`@/auth`), permissions (`src/lib/staff/permissions`), audit (`src/lib/audit`), email (`src/lib/email`), the database client, home cards (`src/modules/contributions`).
- Core reads through `src/lib/directory.ts` (`liveSites`, `allSites`, `liveSiteById`, `staffSiteIds`, `staffAccess`, `activeStaffAccess`), never Core tables.
- The UI kit's workspace frame `ModuleShell`.
- Other modules: none.
