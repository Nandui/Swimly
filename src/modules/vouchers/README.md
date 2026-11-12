# Vouchers

**Purpose:** tracks the vouchers given to communities and organisations.

Its levels are in [docs/apps.md](../../../docs/apps.md#vouchers); why it exists is [D30](../../../docs/decisions.md).

## Features
- `redeem` — check a voucher's code at the desk and mark it as used (`/vouchers`); put right a voucher marked as used by mistake, cancel one voucher; the home card.
- `batches` — give vouchers to one organisation (`/vouchers/batches/new`), the batches under their occasion with how many were used (`/vouchers/batches`), one batch and its vouchers (`/vouchers/batches/[id]`), change or cancel it, and the sheet to print (`/vouchers/batches/[id]/print`).
- `workspace` — the frame, its one page list (`pages.ts`, for the sidebar and the starter page `/vouchers/overview`) and the access check (`src/app/vouchers/layout.tsx`).

`shared/` holds what both features use: the pure rules (`rules.ts`: voucher and batch states, codes, the status maps), the access check (`access.ts`), site scoping and site names for reads (`reads.ts`), whoever manages and the page refreshes for writes (`server.ts`) and the state tags (`components/status.tsx`).

## Rules (`shared/rules.ts`)
- A voucher is **Valid** from its batch's first day to its last, both included, on the pool's day (`today()`); before that **Not valid yet**, after it **Expired**.
- **Used** wins over everything: a used voucher stays used when its batch ends or is cancelled. A voucher is never both used and cancelled (a database check).
- A voucher is accepted only at the sites its batch names (`siteIds`, at least one).
- Codes are eight characters in two groups (`7K3M-9QXD`), from an alphabet without 0, O, 1, I or L, drawn with `crypto.randomInt`. What is typed is forgiven its dashes, spaces and case.
- Using a voucher claims it in one update (`redeemedAt` still empty), so two desks with the same code cannot both use it.
- A batch holds up to 500 vouchers, and that number never changes once made: the codes may be printed.

## Front door (index.ts)
- The status maps (`VOUCHER_STATE_META`, `BATCH_STATE_META`), for Core's tone check.

## Data owned
Declared in `prisma/schema/vouchers.prisma`:
- `voucher_batches` (`VoucherBatch`) — one gift to one organisation: the occasion, who it went to, what each voucher gives, how many, its dates and the sites that accept it.
- `vouchers` (`Voucher`) — one code, with when, where and by whom it was used.

No relations to Core tables: sites and staff are read through Core's functions.

## Events
- Emits: none.
- Listens to: none.

## Registration (module.ts)
- Home and starter page items (`registerHomeCard`): the quick action "Redeem a voucher".
- Menu entry, levels and permissions: `manifest.ts`, listed in `src/app/modules.ts`.

## Permissions
- `vouchers.redeem`, `vouchers.manage`.

## Depends on
- Platform: the policy engine, audit, the database client, the working site (`src/lib/clubs/current`) and home cards (`src/modules/contributions`).
- Core reads (never Core tables; enforced by the boundary lint): sites and the organisation's name through `src/lib/directory.ts` (`liveSiteById`, `liveSitesOf`, `liveSitesWithin`, `sitesByIds`, `organisationName`).
- The UI kit's workspace frame `ModuleShell` (`src/components/ui`).
- Other modules: none.
