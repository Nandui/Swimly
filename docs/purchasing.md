# Purchasing

Owner request, 2 October 2026: a list of approved suppliers, each with its approved
products; purchase orders raised by managers, approved by the stakeholders set per
supplier and per amount by role, then given a purchase order number for the supplier,
sequential per site: `PO-BT-00001`, where BT is the site's short code (CF, DO, ...).

## Surfaces (`/purchasing`, a Work module on the shared `ModuleShell`)

- **Orders** (`/purchasing`): what waits for your approval, your own orders, and the
  latest at your sites. The Hub shows orders to approve and rejected ones to change.
- **New order** (`/purchasing/new`): the site, one approved supplier, quantities of its
  approved products at their agreed prices (before VAT), when it is needed and a note.
  The total and who may approve it update as you type. **Save draft** keeps it private;
  **Send for approval** needs at least one role allowed to approve that much.
- **An order** (`/purchasing/[id]`): laid out as the supplier receives it (supplier and our
  account number, where to deliver, lines, total). Approvers **Approve** or **Reject**
  (with the reason) here; the requester **Changes** a draft or rejected order and sends
  it again, or **Cancels** it before approval. An approved order prints or saves as PDF.
- **Suppliers** (`/purchasing/suppliers`): the approved suppliers, and the **approvers for
  every supplier**. A supplier's page has its details, its **approved products** (name,
  supplier's code, unit, agreed price) and **its own approvers**.

## Approval

A rule is a role and a limit (none means any amount), for one supplier or for every
supplier (`PurchaseApprovalRule`). A supplier's own rules replace the general ones. An
order can be approved by anyone whose role has a rule for its supplier with a limit at or
above its total, who sees its site (`purchasing.read` there), and who did not raise it
(`mayApprove`, `approverRoles` in `src/modules/purchasing/shared/rules.ts`). A superadmin may approve
any amount, never their own. Approvers need at least Purchasing: View to open the module.

## Numbers

Approving gives the order the site's next number in the same transaction:
`PurchaseOrderCounter` holds each site's last number and is raised with the approval, so
numbers never repeat or skip, and two approvers cannot number one order twice. The site's
short code is `Club.code` (two to four capitals), set in Admin, Clubs; the migration gives
Bishopstown BT, Churchfield CF and Douglas DO where they exist. A site without a code
cannot have orders approved until it has one.

## Access

| Level | Permissions | Lets you |
| --- | --- | --- |
| View | `purchasing.read` | See your sites' orders; approve those the rules let your role approve |
| Request | `purchasing.request` | Raise orders at your sites |
| Manage | `purchasing.manage` | Suppliers, approved products and prices, approval rules |

Reach is the person's sites. Every change is audited (module Purchasing); orders with
their site, suppliers, products and rules with none. Lines keep the product's name, code,
unit and price as ordered, so changing a price never changes past orders.

## Files

- Schema: `prisma/schema/purchasing.prisma`, `prisma/migrations/20261018120000_purchasing`
- `src/modules/purchasing/`: `shared/` (`rules.ts`, pure; `access.ts`; `forms.ts`), `features/orders` and `features/suppliers` (each with `server/data.ts` and `server/actions.ts`; the home card is `features/orders/server/home.ts`, registered in `module.ts`), `features/workspace` (the frame). See its README.md
- UI: `src/app/purchasing/` and each feature's `components/`
- Tests: `rules.test.ts`, `purchasing.test.ts` (end to end on an isolated database)

## Not built yet

Emailing the approved order to the supplier, receiving deliveries against it, VAT, and
budgets per site or department.
