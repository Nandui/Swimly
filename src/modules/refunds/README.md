# Refunds

**Purpose:** moves a customer's refund request from the front desk to a finance decision and payment.

The rules for the screens, statuses and emails are in [docs/refunds.md](../../../docs/refunds.md).

## Features
- `queue` — find, filter and count refund requests (`/refunds`), and the home-page counts of what waits for someone.
- `request` — log a request, follow it, attach receipts, and for finance decide and record payment (`/refunds/new`, `/refunds/[id]`, `/api/refunds/files`).
- `workspace` — the Refunds frame, its menu and the access check every Refunds page runs (`src/app/refunds/layout.tsx`).

`shared/` holds what two or more features use: the status and service metadata (`types.ts`), validation and transitions (`rules.ts`), the access check (`auth.ts`), the locked, audited mutation (`service.ts`) and the visibility rule (`data.ts`).

## Public API (index.ts)
- `refundStatuses`, `RefundStatus` — each status's label, tone and icon. Used by Core's status-metadata test.

Nothing else in Turnfin calls into Refunds. Routes use the feature entries (`features/<feature>/index.ts`).

## Data owned
Declared in `prisma/schema/refunds.prisma` (table names kept, ADR 0002):
- `RefundRequest` — one customer refund request, its status and version.
- `RefundEvent` — the history of every change to a request.
- `RefundAttachment` — receipts, stored in the database.
- `RefundNotification` — status emails waiting to be sent, sent or failed.

Refunds also reads Core's `User` and `Club` directly (sites to choose, a person's work sites, email recipients). Moving those reads onto Core functions is phase 3 of [MIGRATION.md](../../../docs/architecture/MIGRATION.md).

## Events
- Emits: none.
- Listens to: none.

## Registration (module.ts)
- Home card: requests to decide, approved refunds to pay, requests sent back, and "Log a refund request".
- Menu entry, levels and permissions: still in `src/modules/registry.ts` (ADR 0004).

## Permissions
- `refunds.read`, `refunds.request`, `refunds.review`, `refunds.process` (the older names, kept; new ones follow `<module>.<feature>.<action>`).

## Depends on
- Platform: auth (`@/auth`), permissions (`src/lib/staff/permissions`), audit (`src/lib/audit`), email (`src/lib/email`), the database client, home cards (`src/modules/contributions`).
- Core reads (never Core tables; enforced by the boundary lint): sites and people through `src/lib/directory.ts` (`liveSites`, `allSites`, `liveSiteById`, `staffSiteIds`, `staffAccess`, `activeStaffAccess`).
- The UI kit's workspace frame `ModuleShell` (`src/components/ui/module-shell.tsx`), also used by Docs, Training, HR and Rota.
- Other modules: none.
