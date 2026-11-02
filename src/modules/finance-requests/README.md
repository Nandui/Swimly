# Finance requests

**Purpose:** moves a desk's request for money, a customer refund or coinage for a till, to a finance decision.

Refunds and Coinage became this one app on 3 November 2026 ([D24](../../../docs/decisions.md)). Each kind keeps its own tables, flow and permissions for now; one `FinanceRequest` table with a detail table per kind is a later step. Its levels are in [docs/apps.md](../../../docs/apps.md#finance-requests).

## Features
- `refund-queue`: find, filter and count refund requests (`/refunds`), Home's counts, and the requests sent for the swim school's reception analytics.
- `refund-request`: log a refund request, follow it, attach receipts, and for finance decide and record payment (`/refunds/new`, `/refunds/[id]`, `/api/refunds/files`).
- `coinage-queue`: find, filter and count coinage requests (`/coinage`), and Home's counts.
- `coinage-request`: ask for coinage, follow it, and for accounts decide it and record the order (`/coinage/new`, `/coinage/[id]`).
- `workspace`: the one frame and page list (`pages.ts`, for the page bar and the starter page `/finance-requests`). The routes live in `src/app/(finance-requests)`; the old `/refunds/overview` and `/coinage/overview` redirect to the starter page. Emails still link to `/refunds/…` and `/coinage/…`.

`shared/access.ts` says who opens the app and which kinds. `shared/refunds/` and `shared/coinage/` each hold a kind's statuses and metadata (`types.ts`), validation and transitions (`rules.ts`), its access check (`auth.ts`), the locked, audited mutation and who is emailed (`service.ts`) and the visibility rule (`data.ts`).

## Front door (index.ts)
- `refundStatuses`, `coinageStatuses`: each status's label, tone and icon. Used by Core's status-metadata test.

## Data owned
Declared in `prisma/schema/finance-requests.refunds.prisma` and `finance-requests.coinage.prisma` (table names kept):
- `RefundRequest`: one customer refund request, its status and version.
- `RefundEvent`: the history of every change to a refund request.
- `RefundAttachment`: receipts, stored in the database.
- `RefundNotification`: refund status emails waiting to be sent, sent or failed.
- `CoinageRequest`: one coinage request: site, who for, needed by, the coins, its status, version and order.
- `CoinageEvent`: the history of every change, each with a snapshot.
- `CoinageNotification`: coinage status emails waiting to be sent, sent or failed.

## Events
- Emits: none.
- Listens to: none.

## Registration (module.ts)
- One home card (`registerHomeCard`): refunds and coinage to decide, approved ones to pay or order, requests sent back, and "Log a refund request" and "Request coinage".
- Desk measures (`registerDeskMeasures`, `refunds.sent`): refund requests sent, for the swim school's reception analytics.
- Menu entry, levels and permissions: `manifest.ts`, listed in `src/app/modules.ts`. A role's stored Refunds or Coinage level counts here, and until a superadmin sets this app's switch it follows theirs (`formerly`).

## Permissions
- `refunds.read`, `refunds.request`, `refunds.review`, `refunds.process`
- `coinage.read`, `coinage.request`, `coinage.review`, `coinage.process`

## Depends on
- Platform: auth (`@/auth`), permissions (`src/lib/staff/permissions`), audit (`src/lib/audit`), email (`src/lib/email`), the database client, home cards and desk measures (`src/modules/contributions`).
- Core reads through `src/lib/directory.ts` (`liveSites`, `allSites`, `liveSiteById`, `staffSiteIds`, `staffAccess`, `activeStaffAccess`), never Core tables.
- The UI kit's workspace frame `ModuleShell`.
- Other apps: none.
