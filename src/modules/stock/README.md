# Stock

**Purpose:** counts the stock on the shelf at each site.

The rules for counting, comparing and the product list are in [docs/stock.md](../../../docs/stock.md).
Ported from Stockly (ADR 0010).

## Features
- `counts` — start a count at a site, count on the sheet, submit, discard or delete it (`/stock`, `/stock/[id]`); the home card.
- `products` — the product list and its categories (`/stock/products`, `/stock/categories`).
- `compare` — two submitted counts at a site side by side (`/stock/compare`).
- `workspace` — the frame, its one page list (`pages.ts`, for the page bar and the starter page `/stock/overview`) and the access check (`src/app/stock/layout.tsx`).

`shared/` holds what two or more features use: the pure rules (`rules.ts`: status maps, category tones, comparing counts), the access check (`access.ts`), access at a count's site and page refreshes for writes (`server.ts`), site scoping for reads (`reads.ts`) and the dialogs' common bits (`components/form-kit.tsx`).

## Public API (index.ts)
- The status maps (`STOCK_TAKE_META`, `STOCK_CHANGE_META`, `STOCK_CATEGORY_TONE_META`), for Core's tone check.

## Data owned
Declared in `prisma/schema/stock.prisma`:
- `stock_categories` (`StockCategory`) — how products are grouped.
- `stock_products` (`StockProduct`) — the product list.
- `stock_takes`, `stock_take_lines` (`StockTake`, `StockTakeLine`) — a count at a site and its counted products.

No relations to Core tables: sites and staff are read through Core's functions.

## Events
- Emits: none.
- Listens to: none.

## Registration (module.ts)
- Starter page items (`registerHomeCard`): counts still open at the person's sites.
- Menu entry, levels and permissions: `manifest.ts`, listed in `src/app/modules.ts`.

## Permissions
- `stock.read`, `stock.count`, `stock.manage`.

## Depends on
- Platform: the policy engine, audit, the database client and home cards (`src/modules/contributions`).
- Core reads (never Core tables; enforced by the boundary lint): sites through `src/lib/directory.ts` (`liveSiteById`, `liveSitesWithin`, `withSites`).
- The UI kit's workspace frame `ModuleShell` (`src/components/ui`).
- Other modules: none.
