# Reception

The staging redesign at `/reception` puts swimmer search above a connected
workspace. The selected swimmer stays visible alongside today's classes.
Places, contact, notes and progress tabs retain that selection. On phones,
Swimmer and Today views retain filters and selection when switching.

Search is bounded, server-backed and scoped to the current club. Reception can
find inactive swimmers, while enrolment pickers default to active records.
Inactive swimmers cannot be enrolled until reactivated. Details include only
the selected swimmer, their open places, relevant notes, progress and a bounded
assessment booking history. Transfer options load when needed.

Today provides All day / Now and next filters, time or level grouping, cover
information and explicit availability. It refreshes every minute while idle;
an open dialog or active input prevents interruption. Selection and grouping
remain in the URL. Switching clubs remounts the workspace and refuses records
outside that club.

Enrolment, move, unenrolment, waitlist promotion and assessment booking reuse
the existing server actions: named permissions, club boundaries, capacity
locks, placement validation and atomic audits. Booking an assessment stays
beside the selected swimmer. Failed forms retain entered values; closing
restores trigger focus. No write happens merely by opening a dialog.

The Reception screen and landing page remain configurable through Roles.
Enrolment requires `enrolment.manage`, adding a swimmer requires
`students.manage`, and booking requires `enrolment.manage`. Links to other
screens respect their visibility settings.

## Verification — 9 September 2026

The main app passed type checking, lint and 125 isolated tests covering
permissions, club scoping, capacity, transfers, audits, saving and recovery.
A migration-free Next build passed. Synthetic Reception and poolside browser
checks covered both themes at 375, 768, 1024 and 1280px (16 cases): no horizontal
overflow, serious/critical WCAG audit violations or browser runtime errors.

Interaction checks covered assessment selection, failed submissions retaining
input, dialog focus restoration, mobile selection retention, attendance
confirmation and reopening, and shared competency edits across both views.
Tests intercepted all mutation requests and used fictional records. No live
swimmer records were edited for verification. The temporary review route was
removed before deployment. Earlier layout evidence is historical; the current
design authority is [DESIGN.md](../DESIGN.md).
