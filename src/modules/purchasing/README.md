# Purchasing

**Purpose:** gets purchase orders from approved suppliers raised, approved by the right people and numbered.

Its levels are in [docs/apps.md](../../../docs/apps.md).

## Features
- `orders` — raise, change, send, approve or reject, cancel and print purchase orders, and email approved ones to the supplier after a test to yourself (`/purchasing`, `/purchasing/new`, `/purchasing/[id]`, `/purchasing/[id]/edit`, `/purchasing/[id]/email`), and the home-page counts.
- `suppliers` — approved suppliers (with an optional picture), their products and prices, the approval rules by role and amount, and the switch for emails to suppliers (`/purchasing/suppliers`, `/purchasing/suppliers/[id]`).
- `workspace` — the Purchasing frame, its one page list (`pages.ts`, for the page bar and the starter page `/purchasing/overview`) and the access check (`src/app/purchasing/layout.tsx`).

`shared/` holds what both features use: approval and money rules (`rules.ts`, pure, tested in `rules.test.ts`), the access check (`access.ts`), form helpers with page revalidation (`forms.ts`), whether emails to suppliers are on (`settings.ts`) and a supplier's picture or initials (`supplier-picture.tsx`, used by the supplier pages and the order form).

## Front door (index.ts)
- None. Nothing outside Purchasing calls into it; routes use the feature entries.

## Data owned
Declared in `prisma/schema/purchasing.prisma` (table names kept):
- `Supplier` — an approved supplier, and its picture (a small WebP kept on the row).
- `PurchaseProduct` — a supplier's approved product and agreed price, and for retail products its brand and the sizes and colours it comes in.
- `PurchaseApprovalRule` — a role that may approve up to an amount, for one supplier or all.
- `PurchaseOrder`, `PurchaseOrderLine` — an order and its lines (one per product, size and colour).
- `PurchaseOrderCounter` — retired: numbered the old per-site orders (PO-BT-00001); kept, no longer written.
- `PurchaseOrderEmail` — every email of an approved order: to the supplier or a test to the sender, sent or failed.
- `PurchasingSettings` — per organisation, whether approved orders may be emailed to suppliers (off until Manage turns it on), and who is copied on them.


## Events
- Emits: none.
- Listens to: none.

## Registration (module.ts)
- Starter page items (`registerHomeCard`; Home counts the ones that need the person): orders to approve, your rejected orders to change, and "Raise a purchase order".
- Menu entry, levels and permissions: `manifest.ts`, listed in `src/app/modules.ts`.

## Permissions
- `purchasing.read`, `purchasing.request`, `purchasing.manage`.

## Depends on
- Platform: auth and the policy engine (`src/lib/policy`), audit, square pictures (`src/lib/images`), permissions, the database client, home cards (`src/modules/contributions`), Core's email sender (`src/lib/email`).
- Core reads (never Core tables; enforced by the boundary lint): sites and roles through `src/lib/directory.ts` (`withSiteStatus`, `liveSitesOf`, `allRoles`, `rolesByIds`, `withRoles`, `staffRoleIdOf`, `staffContact`, `organisationName`).
- The UI kit's workspace frame `ModuleShell` (`src/components/ui/module-shell.tsx`).
- Other modules: none.
