# Purchasing

Owner request, 2 October 2026: a list of approved suppliers, each with its approved
products; purchase orders raised by managers, approved by the stakeholders set per
supplier and per amount by role, then given a purchase order number for the supplier,
`BT-OCT-0042`: the site's short code (BT, CF, DO, ...), the month it was approved and a
running number (owner request, 15 October 2026; orders approved before then keep `PO-BT-00001`).

## Surfaces (`/purchasing`, a Work module on the shared `ModuleShell`)

- **Orders** (`/purchasing`): what waits for your approval, your own orders, and the
  latest at your sites. The Hub shows orders to approve and rejected ones to change.
- **New order** (`/purchasing/new`): the site, one approved supplier, quantities of its
  approved products at their agreed prices (before VAT), when it is needed and a note.
  A product that comes in sizes or colours gets a line for each one: pick the size and
  colour, **Add line**, then the quantity. The total and who may approve it update as you type. **Save draft** keeps it private;
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
  supplier's code, unit, agreed price and, for retail products, the brand and the sizes and
  colours it comes in) and **its own approvers**.

## Approval

A rule is a role and a limit (none means any amount), for one supplier or for every
supplier (`PurchaseApprovalRule`). A supplier's own rules replace the general ones. An
order can be approved by anyone whose role has a rule for its supplier with a limit at or
above its total, who sees its site (`purchasing.read` there), and who did not raise it
(`mayApprove`, `approverRoles` in `src/modules/purchasing/shared/rules.ts`). A superadmin may approve
any amount. Administrators (Admin: Manage, and superadmins) may also approve their own
orders (owner decision, 15 October 2026); everyone else needs someone else to approve. Approvers need at least Purchasing: View to open the module.

## Numbers

Approving gives the order its number in the same transaction: `<site code>-<month>-<running
number>`, for example `BT-OCT-0042` (owner request, 15 October 2026). The month is the one the
order is approved in, Irish time, as three capitals. The running number is one count for the
whole organisation (one more than the highest so far, under a lock held until the approval commits), at least four digits, and never
resets, so it is unique on its own; it is raised with the approval, so numbers never repeat
or skip, and two approvers cannot number one order twice. Orders approved before then keep
their old `PO-BT-00001` numbers, which suppliers and invoices already quote;
`PurchaseOrderCounter`, which counted those per site, is no longer written. The site's
short code is `Club.code` (two to four capitals), set in Admin, Sites; the migration gives
Bishopstown BT, Churchfield CF and Douglas DO where they exist. A site without a code
cannot have orders approved until it has one.

## Emailing the supplier

Owner request, 15 October 2026: after approval, send the order straight to the supplier,
with a way to test the emails before a real one goes out.

- The email (`features/orders/server/order-email.ts`, pure) has the order number, our
  account number, where to deliver, when it is needed, the products (with brand, size and
  colour where they have them), codes, units and quantities, and the note, in plain text and HTML. It carries **no prices or totals**: the
  supplier invoices at the agreed prices (owner decision, 15 October 2026). A highlighted
  **Invoices** box asks for every invoice for the order to go to
  invoices@leisureworldcork.com, quoting the order number (`INVOICE_ADDRESS`). It goes from Core's mailbox (`src/lib/email/sender.ts`)
  named "<organisation> Purchasing", to the supplier's `email`, with **Reply-To** whoever
  raised the order (owner request, 15 October 2026), or the sender when that person has no
  email address.
- **Deliver to** is the site's name (with the organisation in front only when the name
  does not already carry it) and its postal address from Admin > Sites (`Club.address`,
  read through `siteAddress` in `src/lib/directory.ts`; owner request, 15 October 2026).
  The order page shows the same address.
- **Look** (owner request, 15 October 2026): the white LeisureWorld logo on a navy band with
  the order number, a panel of the order's details, the products with their quantities, the
  note, the Invoices box and the sender, in tables and inline styles that mail clients render.
  The logo (`assets/email`, read by `src/lib/email/logo.ts`) travels inside the email as an
  inline image (`PO_EMAIL_LOGO_CID`); the preview page shows it from `/purchasing/email-logo`
  instead, because a browser cannot show `cid:` images.
- **Copy to**: up to five addresses set under Suppliers (`PurchasingSettings.copyTo`, stored
  as "a@x, b@y", Manage) get a CC of every email to a supplier, visible to the supplier;
  tests are not copied (owner requests, 15 October 2026). Whoever raised the order is
  always copied too, ahead of that list. Each email
  keeps who was copied (`PurchaseOrderEmail.ccAddress`).
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
unit, brand and price as ordered, and the size and colour picked, so changing a price never changes past orders.

## Files

- Schema: `prisma/schema/purchasing.prisma`, `prisma/migrations/20261018120000_purchasing`, `prisma/migrations/20261106120000_purchase_order_emails`, `prisma/migrations/20261107120000_purchasing_email_copy`
- `src/modules/purchasing/`: `shared/` (`rules.ts`, pure; `access.ts`; `forms.ts`), `features/orders` and `features/suppliers` (each with `server/data.ts` and `server/actions.ts`; the home card is `features/orders/server/home.ts`, registered in `module.ts`), `features/workspace` (the frame). See its README.md
- UI: `src/app/purchasing/` and each feature's `components/`
- Tests: `rules.test.ts`, `order-email.test.ts`, `purchasing.test.ts` (end to end on an isolated database, with the email transport replaced so nothing is sent)

## Not built yet

Receiving deliveries against it, VAT, and
budgets per site or department.
