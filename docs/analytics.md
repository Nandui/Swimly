# Analytics

`/analytics` is a read-only shadcn dashboard under Monitoring. It follows the
site selected in the sidebar, with no separate page selector or URL scope override.
Administrators inherit this
screen automatically. Other roles need an explicit `analytics` screen grant.
Instructor remains a separate workspace. Schedule remains the default desk home.

## Metric definitions

- **Total swimmers enrolled:** distinct swimmers with at least one ACTIVE
  enrolment at a selected site, an ACTIVE swimmer record and a non-archived
  class. The start date must be today or earlier; the end and scheduled end
  must be later than today or unset. Dates use Europe/Dublin. Class places
  count qualifying enrolments, so one swimmer can hold several places.
  Cancelling a single session does not end a weekly enrolment.
- **Enrolled by level:** current enrolled class places divided by the sum of
  capacity across the level's non-archived weekly classes at the selected site.
  Both sides use the class's current canonical shared level, not a swimmer's
  historical placement level. The numerator uses the current-enrolment rules
  above; a swimmer enrolled in two classes occupies two places, including two
  at the same level. The headline total still counts distinct swimmers.
  Empty classes contribute their full capacity, once each. A single cancelled
  session does not reduce weekly capacity. Bars show each level's own occupancy
  percentage, never its size relative to the largest level. Over-capacity
  percentages remain visible while the bar stops at 100%. Any uncapped class
  makes that level uncapped; no finite percentage is shown. Levels with no
  classes or zero capacity are labelled explicitly. Live zero-count levels
  remain visible; archived levels/programmes remain while they have current
  enrolments or non-archived classes.
- **Enrolments and unenrolments:** recorded `Enrolment` audit actions `enrol`
  and `withdraw` during today and the previous six Dublin calendar days.
  Waitlist promotions count at activation. Waitlist-only removals are excluded,
  as are moves, completions and bulk imports recorded against `Course`.
  Scheduled withdrawals count on the date the withdrawal is applied and
  recorded, which can differ from its effective end date. These are activity
  counts, not unique new/lost customers or the net change in enrolled swimmers.
- **Class cancellations:** cancelled sessions dated in the current Dublin
  calendar month, including later sessions if records exist. Bookings affected
  count the frozen cancellation roster. Awaiting billing and Billing notified
  are the split for this month, not the queue's backlog across all dates.
  The billing follow-up link appears only for the selected site and users
  with access to Cancelled classes; that queue covers all dates.

## Data and presentation

All queries run in one repeatable-read snapshot. Site IDs are parameterized,
and the returned page data contains aggregate counts and curriculum labels,
not swimmer identifiers, names, contacts or audit summaries. Analytics does
not write records. The existing authenticated-session hook continues to apply
authorized scheduled unenrolments as it does elsewhere in the app.

The bento grid adapts to phone, tablet and desktop widths. Level bars have exact
numeric labels; daily activity uses a table. Dates, scope and update time are
visible. Refresh, loading, error and zero-result states are explicit. No new
chart dependency is needed. Tests cover site scope, access, duplicate swimmers,
shared levels, calendar boundaries, waitlists, cancellation rosters and DST.
