# Turnfin Refunds

Refunds is a separate staff workspace for all LeisureWorld services, reached from
the general Turnfin portal and Reception Portal. It shares staff identity and the
main Turnfin database. It never sends money, changes Legend, emails customers or
requires a swimmer record. Docs retains its separate database; Refunds shares its shell layout but has its own Poolside Clear theme.

## Reception and finance workflow

1. Reception opens **New request**. Choose either site and Aquatics, Membership,
   Booking or Other. Submission requires the customer name, service description,
   requested EUR amount, original payment date/reference and refund reason.
   Contact details, member number and receipts are optional. Do not enter bank or
   card details. Amounts are stored as integer cents.
2. **Save draft** permits incomplete information. Drafts are private to their
   creator, including drafts withdrawn before submission. Save first to attach
   optional receipts, then **Submit to finance**.
3. The shared queue starts with both sites. Finance initially sees requests
   awaiting review or payment. Search and site, status, service, submitter and
   handler filters narrow the queue. Totals follow all filters except status.
4. Finance can **Take responsibility** or explicitly take over from a colleague.
   This is an assignment, not a lock. Other authorised finance staff can help.
5. Finance approves, declines or requests information. Requesters cannot review
   their own requests. Declines and information queries require a reason. An
   approval must be positive, at most the requested amount, and include a reason
   if reduced. The original requested amount remains visible.
6. Reception can amend any submitted request returned for information and
   resubmit. Earlier submissions, finance queries, receipts and decisions remain
   in chronological history, with the actor and time.
7. Approved requests display **Awaiting payment**. After paying through the
   external payment system, finance records the payment date, method and
   reference for the full approved amount. Turnfin records one payment only.
   The finance approver can record that payment if separately permitted.
8. Reception can withdraw drafts and unapproved requests. Finance can cancel an
   unpaid approval with a reason. Refunded records have no edit/delete actions.
   Instalments and payment corrections are outside this version.

## Access

Grant the **Refunds** screen and named permissions through **Roles**. No role
names are matched and no staff records are automatically changed.

| Permission | Enables |
| --- | --- |
| `refunds.read` | Shared submitted requests and own drafts |
| `refunds.request` | Draft, submit, amend returned requests, receipts, withdraw |
| `refunds.review` | Assign/take over review, approve, decline, return, cancel unpaid approval |
| `refunds.process` | Assign/take over payment, record external payment, cancel unpaid approval |

The three mutation permissions imply reading. Review and processing remain
independent. Review or process permits retrying staff alerts. Administrators
inherit current and future grants via `expandPermissions` and `visibleScreens`.
Refunds-only staff gain neither Aquatics nor Instructor access. All reads,
actions and receipt downloads recheck shared staff authentication/grants; queued
email delivery rechecks the recipient's current active status and access.

## Storage and reliability

The additive migration `20260923120000_refunds` introduces `RefundRequest`,
`RefundEvent`, `RefundAttachment` and `RefundNotification`. Identity/site names
are snapshotted to preserve historical attribution. It does not migrate or alter
existing Aquatics records or Docs content.

Every workflow/receipt mutation locks its request inside a transaction, checks
the submitted version, and writes the change, event snapshot, audit row and any
notification jobs atomically. Stale decisions fail without partial updates.
Client operation IDs and a unique event key make repeated submission/payment
attempts safe. A retry of a completed operation returns the current request.
Payment updates are forbidden once refunded. Database checks also enforce valid
statuses and amount/payment constraints.

Receipts are private database bytes, never public object URLs. Maximum five
active files per request, 4 MB each: PDF, JPEG, PNG or WebP. Validation checks
size, extension, declared MIME type and format signature. Uploads require
same-origin requests and have a bounded body reader. Downloads require request
access and use attachment disposition, no-store, nosniff and a sandbox policy.
Removed receipts remain in protected history. This is format validation, not a
malware scanning service.

## Staff alerts

Set `REFUNDS_APP_URL` to the canonical HTTPS staff-app origin. Reuse the existing
Google Workspace configuration (`PARENT_GOOGLE_CLIENT_ID`,
`PARENT_GOOGLE_CLIENT_SECRET`, `PARENT_GOOGLE_REFRESH_TOKEN` and
`PARENT_EMAIL_FROM`) and company mailbox,
with **Turnfin Refunds** as the display name. Parent sign-in email content and
configuration remain unchanged. The shared Google transport keeps send-only
scope checks and a bounded timeout.

Submission/resubmission queues alerts to all active staff with the Refunds
screen and review access, excluding the requester. Information requests,
decisions, cancellation and completed payment notify the original requester if
they still have access. Messages contain only the RF number, status and an
authenticated link. No customer details or files are sent.

Jobs are persisted before delivery and attempted after the workflow transaction
commits. Delivery failures never roll back the request. The detail page shows
pending/failed alerts and their safe error text, with **Retry staff alerts** for
finance. Missing recipient setup also remains visible and can be reconciled
after Roles is fixed. Revoked/inactive recipients are skipped. Accepted jobs are
not resent; an uncertain provider response may already have delivered and a
manual retry can send another email. Retries claim jobs atomically; abandoned
sends are retryable after two minutes. Each call attempts up to 20 jobs; any
remainder stays visible for retry. No scheduled worker is required in this
version.

## Deployment

1. Publish the staff application with its normal additive Prisma migration step.
   Confirm `20260923120000_refunds` is applied before using the module. Development
   and production share this database; do not reset, seed or use `db push`.
2. Configure `REFUNDS_APP_URL` and confirm the existing authorised Google sender
   is available to the staff deployment. Do not change parent-app URLs or Docs
   database variables.
3. Through Roles, add the Refunds screen and `refunds.request` to the agreed
   reception staff grants. Add `refunds.review` and/or `refunds.process` to the
   agreed finance staff grants. Preserve every existing grant and role home.
4. If activating the pending Reception Portal at the same time, set its explicit
   home preference as described in [Reception Portal](reception-portal.md).
5. Verify sign-in, grants, a permitted staff-only notification and protected
   downloads in the published environment. Use an authorised test request;
   do not create fictional customer records in production without agreement.

This implementation has not applied a live migration, changed role grants,
configured production email settings or sent real messages.

## Verification

Focused tests use PGlite with generated Prisma and the actual SQL migrations;
email delivery and authentication are mocked. No production connection is used.
They cover draft privacy, both sites, screen/permission boundaries, administrator
inheritance, self-review prevention, concurrent decisions, atomic audit rollback,
duplicate operation retries, reduced approvals, returns/resubmission, withdrawal,
cancelled approvals, final payment records, receipt bytes/access/size/type/count,
same-origin upload routes, active recipients, revoked access and email failures.
Parent sign-in/API, role/screen, navigation and Reception Portal regressions run
alongside Refunds checks.

See [the isolated preview](../scripts/refunds-preview/README.md) for the actual
components and full workflow with fictional customers and mocked email.

Verified on 23 September 2026:

- `npm run typecheck` and `npm run lint` passed.
- All 61 tests passed across Refunds, parent email/API, role/screen access,
  navigation and Reception Portal.
- The optimized Next production build passed with a dummy connection URL,
  without invoking the deployment migration command or a live database.
- Browser journey: save draft, submit, request information, amend/resubmit,
  reject an unexplained reduction, approve with a reason, record external
  payment and inspect the immutable history. Read-only staff have no actions.
- Queue search/empty/reset, form error recovery and dialog keyboard focus
  trap/return passed. Queue, detail and new-request layouts passed at 375, 768,
  1024 and 1280px in both themes: one H1, no overflow, 44px controls.
- Captured phone/desktop views received an inline visual review because the
  project prohibits delegation. The design detector returned no findings.
- The Chrome extension blocked automated file-picker upload. Actual production
  upload/download handlers passed isolated HTTP tests with stored receipt bytes.

Live authentication, delivery from the company mailbox and deployed database
connectivity remain deployment checks; mocked delivery is not evidence that
production sender configuration is present.

## Workspace appearance

Refunds uses the Poolside Clear design: Plus Jakarta Sans (self-hosted through
`@fontsource/plus-jakarta-sans`), the fin logo's deep teal for actions and
selection, an aqua focus halo, a cool canvas with white panels, and a deep
pool-night dark mode. The tokens are in `src/app/refunds/refunds.css` under
`.turnfin-refunds` and re-point the shared `--ui-*` tokens, so shadcn controls,
dialogs, select popovers and the mobile sheet follow them. Every text and control
pair meets 4.5:1 (text) or 3:1 (edges, focus) in both themes.

`RefundShell` still shares the Docs shell layout, brand and appearance controls,
and owns its navigation, mobile sheet, breadcrumb and `turnfin.refunds.sidebar`
collapse cookie. No Docs data or permissions are imported. Status badges come from
`RefundStatusTag` (`src/components/refunds/status.tsx`), which adds a distinct icon
to each status label. Queue filters, forms, history and finance dialogs keep their
existing behaviour. Aquatics, Docs and the portals keep their own themes.

The theme was checked in the isolated preview (`scripts/refunds-preview`) on the
queue, request details and a finance dialog, in light and dark at 1280px and at
375px. That check covered one H1, no horizontal overflow and 44px controls.
Typecheck, lint and the Refunds tests passed.
