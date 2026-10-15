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
  it again, or **Cancels** it before approval. An approved order prints or saves as PDF,
  or is emailed to the supplier (below).
- **Email** (`/purchasing/[id]/email`): the approved order's email exactly as the supplier
  gets it (To, Replies go to, Subject and the email itself), **Send test to me**,
  **Send to supplier** once emails to suppliers are on, and every email sent so far.
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

## Emailing the supplier

Owner request, 15 October 2026: after approval, send the order straight to the supplier,
with a way to test the emails before a real one goes out.

- The email (`features/orders/server/order-email.ts`, pure) has the order number, our
  account number, where to deliver, when it is needed, the products, codes, units and
  quantities, and the note, in plain text and HTML. It carries **no prices or totals**: the
  supplier invoices at the agreed prices (owner decision, 15 October 2026). A highlighted
  **Invoices** box asks for every invoice for the order to go to
  invoices@leisureworldcork.com, quoting the order number (`INVOICE_ADDRESS`). It goes from Core's mailbox (`src/lib/email/sender.ts`)
  named "<organisation> Purchasing", to the supplier's `email`, with **Reply-To** the
  sender's own address.
- **Send test to me** sends the same email to the sender's own address only, with "Test:" in
  the subject and a line on top naming the supplier's address.
- **Emails to suppliers** (`PurchasingSettings.supplierEmailsOn`, per organisation) start
  off; while off, only tests can be sent. Purchasing: Manage turns them on under Suppliers,
  only once a test has been sent (`setSupplierEmails`), and can turn them off again.
- Who may email an order: it must be approved and numbered; whoever raised it, anyone with
  `purchasing.request` at its site, or Purchasing: Manage.
- Every attempt, sent or failed, is a `PurchaseOrderEmail` row shown on the order, and an
  audit row (action `email`). A failure says so and nothing is retried on its own; sending
  again to the supplier asks first, saying they already have it.

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

- Schema: `prisma/schema/purchasing.prisma`, `prisma/migrations/20261018120000_purchasing`, `prisma/migrations/20261106120000_purchase_order_emails`
- `src/modules/purchasing/`: `shared/` (`rules.ts`, pure; `access.ts`; `forms.ts`), `features/orders` and `features/suppliers` (each with `server/data.ts` and `server/actions.ts`; the home card is `features/orders/server/home.ts`, registered in `module.ts`), `features/workspace` (the frame). See its README.md
- UI: `src/app/purchasing/` and each feature's `components/`
- Tests: `rules.test.ts`, `order-email.test.ts`, `purchasing.test.ts` (end to end on an isolated database, with the email transport replaced so nothing is sent)

## Not built yet

Receiving deliveries against it, VAT, and
budgets per site or department.
