# Purchasing

**Purpose:** gets purchase orders from approved suppliers raised, approved by the right people and numbered.

The rules for the screens and approvals are in [docs/purchasing.md](../../../docs/purchasing.md).

## Features
- `orders` — raise, change, send, approve or reject, cancel and print purchase orders (`/purchasing`, `/purchasing/new`, `/purchasing/[id]`, `/purchasing/[id]/edit`), and the home-page counts.
- `suppliers` — approved suppliers, their products and prices, and the approval rules by role and amount (`/purchasing/suppliers`, `/purchasing/suppliers/[id]`).
- `workspace` — the Purchasing frame, its menu and the access check (`src/app/purchasing/layout.tsx`).

`shared/` holds what both features use: approval and money rules (`rules.ts`, pure, tested in `rules.test.ts`), the access check (`access.ts`) and form helpers with page revalidation (`forms.ts`).

## Public API (index.ts)
- None. Nothing outside Purchasing calls into it; routes use the feature entries.

## Data owned
Declared in `prisma/schema/purchasing.prisma` (table names kept, ADR 0002):
- `Supplier` — an approved supplier.
- `PurchaseProduct` — a supplier's approved product and agreed price.
- `PurchaseApprovalRule` — a role that may approve up to an amount, for one supplier or all.
- `PurchaseOrder`, `PurchaseOrderLine` — an order and its lines.
- `PurchaseOrderCounter` — the next order number for each site.

Purchasing also reads Core's `User`, `Club` and `StaffRole` directly (sites, the approver's role, role names). Moving those reads onto Core functions is phase 3 of [MIGRATION.md](../../../docs/architecture/MIGRATION.md).

## Events
- Emits: none.
- Listens to: none.

## Registration (module.ts)
- Home card: orders to approve, your rejected orders to change, and "Raise a purchase order".
- Menu entry, levels and permissions: still in `src/modules/registry.ts` (ADR 0004).

## Permissions
- `purchasing.read`, `purchasing.request`, `purchasing.manage`.

## Depends on
- Platform: auth and the policy engine (`src/lib/policy`), audit, permissions, the database client, home cards (`src/modules/contributions`).
- Core reads (never Core tables; enforced by the boundary lint): sites and roles through `src/lib/directory.ts` (`withSiteStatus`, `liveSitesOf`, `allRoles`, `rolesByIds`, `withRoles`, `staffRoleIdOf`).
- The UI kit's workspace frame `ModuleShell` (`src/components/ui/module-shell.tsx`).
- Other modules: none.
