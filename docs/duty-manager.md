# Duty manager and cancellation follow-up

`/duty` gives staff a quick view of today's classes at the selected site.
Search by class, level, programme, instructor, pool or time. All, On now,
Upcoming and Cancelled filters preserve the full day. Quick view contains
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
confirmed class ownership on the pool deck.

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
