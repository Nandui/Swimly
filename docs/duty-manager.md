# Duty manager and cancellation follow-up

`/duty` gives staff a quick view of today's classes at the selected site.
Search by class, level, programme, instructor, pool or time. All, On now,
Coming up and Cancelled filters preserve the full day. Each class is one row:
a time block and status tag from the same `HOME_SESSION_META` map and
`sessionState` helper as the home timeline (On now, Coming up, Cover needed
when nobody is teaching it, Finished, Cancelled), then programme, instructor,
pool and swimmer count, or the reason once cancelled. On phones Quick view
and Cancel session become 44px icon buttons that keep their full names for
screen readers. People who can open Cancelled classes see a link to it in the
header, with the number still awaiting billing. Quick view contains
the instructor, attendance count and swimmer names/member numbers; it does
not expose medical notes or contact details.

Cancel session requires a reason and confirmation. It affects only today's
occurrence. It does not archive the weekly class, end enrolments, create
absences, delete teaching records or issue a refund. Existing attendance is
retained and called out in the billing review. Further starts, attendance,
class competencies and class completion saves are blocked under the same
course lock as cancellation, including saves from stale tabs.

`/cancellations` lists sessions awaiting billing follow-up across all dates at
the selected site, oldest first, 25 per page. Each record freezes the class,
time, pool, instructor, reason, cancelling staff member and enrolled swimmers.
Transfers, later enrolments or renamed classes cannot change that evidence.
After contacting billing through the existing process, staff enter a handoff
note and choose Mark billing notified. The entry moves to Billing notified
history; it is not deleted. This records a manual notification, not an email
delivery or billing adjustment. Both actions are audited and retry-safe.

### Legend: process, then restore (owner decisions, 9 October 2026)

The billing follow-up has three stages, `?view=awaiting|restore|done`:

1. **Awaiting billing.** **Export for Legend** downloads Legend's "Bulk Update Template - BO"
   (`bulk-log.ts`) for the classes on screen: one row for each affected member and agreement
   price, with FirstName, LastName, Memberno, Aquatics as Agreement and NewAgreement, and
   "Water Safety & Fun" or "Swimming Skills" as agreementprice and Newagreementprice. Any other
   programme keeps its own name. After processing it in Legend, **Mark processed** confirms
   exactly those classes: they are billing notified, and move to To restore.
2. **To restore.** Once the direct debit run is done, **Export price restore** gives the same
   file with NewCycleFee, which is the agreement price's monthly price from **Billing prices**
   (`/cancellations/prices`, `LegendAgreementPrice`, the same at every site, kept by swim school
   Manage and linked from Admin's overview). A price not set yet is left empty, with a warning.
   **Mark restored** confirms them.
3. **Done.** Restored classes, and handoffs recorded by hand with a note.

The export link carries the ids of the classes on screen, so the file and the confirmation
after it name the same classes. Exports and both confirmations are audited
(`billing-actions.ts`; `src/lib/xlsx-write.ts` writes the workbook with no dependency).

## Access setup

Administrators automatically receive every screen and permission, including
Duty manager, Cancelled classes, cancellation and billing follow-up. Administrator
access is defined by holding both `staff.manage` and `roles.manage`, independent
of the role's name, and includes future additions. No role-data update is needed.

For other roles, give the relevant role the **Duty manager** screen and **Cancel
today’s class sessions** (`classes.cancel`) permission. Duty manager can also
be its landing page. Give staff responsible for follow-up the **Cancelled
classes** screen and **Record billing notifications** (`billing.notify`).
Screen access alone allows reading. Neither permission is implied by timetable
editing. Restricted roles retain their existing grants. Instructor remains
isolated from desk navigation; instructor-only roles cannot reach either new
view without an explicit screen grant. Administrator access does not bypass
dated class start confirmation on the pool deck.

## Data and rollout

The additive `20260913120000_class_cancellations` migration adds two tables,
`ClassCancellation` and `CancelledClassSwimmer`, plus their indexes and foreign
keys. One cancellation per class/date and one affected row per swimmer are
enforced by unique constraints. Class and enrolment rows remain untouched.
The shared schema has been updated; the feature code is on dev. Enable real
cancellations only after all app deployments use the cancellation guards.

The operational choice is currently one dated session and a manual in-app
billing queue. Automated delivery needs an agreed recipient/channel and a
separate delivery implementation.

Verification uses synthetic browser fixtures and isolated tests. No real
classes are cancelled or billing notifications recorded to test this flow.
