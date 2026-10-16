# Analytics

`/analytics` is the swim school's reports, for Swim school **Manage** only (the
`analytics` screen, `courses.manage`). Code: `src/modules/activities/features/analytics`
(`server/insight-queries.ts` reads, `server/swimmers.ts`, `server/teaching.ts` and
`server/insights.ts` compute, `components/insights/` draws). Styles are in
`src/app/(activities)/analytics/analytics.css`.

## Reports (October 2026)

Every report takes `?range=4w|13w|26w|52w` (default 13 weeks, starting on a Monday)
and `?sites=all` (every site the person works at; default the working site), and
compares with the same length of time just before.

- **Overview** (`/analytics`): swimmers now, places filled, waiting list, joined,
  left, stayed, attendance and level passes; a weekly trend with joiners and
  leavers; Needs attention; why swimmers left; ages.
- **Classes** (`/analytics/classes`, `/analytics/classes/[id]`): a day × start-hour
  heat map of places filled, each level, every class; a class shows its swimmers'
  attendance, last lessons and skills, its waiting list, leavers and every lesson
  with who started it.
- **Swimmers** (`/analytics/swimmers`): month-by-month joiners and leavers and
  drop-off, reasons, tenure, level left from, ages, swimmers who may leave, leaving
  soon and every leaver.
- **Progression** (`/analytics/progression`): per level the swimmers, passes, the
  median weeks to pass, skills done, the hardest skill and swimmers over 26 weeks
  at one level; assessments and how many went on to take a place within 30 days.
- **Teachers** (`/analytics/teachers`, `/analytics/teachers/[key]`): per teacher,
  lessons, cover, missed starts, attendance, on-time starts (within 5 minutes),
  registers complete, skills ticked, passes and leavers, against the school.

Rules the figures share:

- A **swimmer** is counted once however many places they hold. Places that join up
  within 14 days, across classes or sites, are one stay, so moving class or site and
  short breaks are not leaving. A leaver is counted at the site of their last place.
  Waitlist-only places are never counted as having taken a place.
- A place ends on `endedOn`, or its booked `scheduledEndOn`.
- **Leave reasons** come from `Enrolment.leaveReason`, asked by Unenrol from
  16 October 2026 (`shared/enrolment/leave-reasons.ts`). Earlier leavers show Not
  recorded; a place ended as finished counts as "finished their class".
- A **lesson belongs to whoever started it** on the pool deck (`ClassCover`). The
  planned teacher is the rota Plan's (`ClassPlannedTeacher`), else the class's set
  instructor; a finished lesson with swimmers that nobody started is a missed start
  against the planned teacher. Lateness is the start record's time against the
  lesson time.
- **May leave**: missed three in a row, or under 60% of the last eight lessons with
  at least four marked.
- Teacher figures in gold are more than 10 points worse than the school's.

The sandbox (`npm run sandbox`) seeds a year of invented Hillview history for these
reports (`scripts/sandbox-swim-history.ts`), including one teacher with weaker
figures to check the comparisons.

## Older reports

The figures below describe the Registers (`/analytics/instructors`), Reception
activity and Multiple enrolments reports, and the previous dashboard.

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
  and `withdraw` during the current Monday–Sunday Dublin calendar week, up to
  the time of the report. Future days are displayed as upcoming. The week resets
  at Monday 00:00 in Europe/Dublin, including daylight-saving changes.
  Waitlist promotions count at activation. Waitlist-only removals are excluded,
  as are moves, completions and bulk imports recorded against `Course`.
  Scheduled withdrawals count on the date the withdrawal is applied and
  recorded, which can differ from its effective end date. These are activity
  counts, not unique new/lost customers or the net change in enrolled swimmers.
- **Class cancellations:** cancelled sessions dated in the current Dublin
  calendar month, including later sessions if records exist. Bookings affected
  count the frozen cancellation roster. Awaiting billing and Billing notified
  are the split for this month, not the queue's backlog across all dates.
  The Cancelled classes link appears only for the selected site and users
  with access to Cancelled classes; that queue covers all dates.

## Data and presentation

The overview queries run in one repeatable-read snapshot; each detail report
uses one SQL statement for a consistent snapshot. Site IDs are parameterized,
and the returned page data contains aggregate counts, class labels and staff names,
not swimmer identifiers, names, contacts or audit summaries. Analytics does
not write records. The existing authenticated-session hook continues to apply
authorized scheduled unenrolments as it does elsewhere in the app.

Figure tiles, then two panels side by side, then a full-width Daily activity panel
adapt to phone, tablet and desktop widths (DESIGN.md, Analytics). Level bars have exact
numeric labels; daily activity uses a table. Dates, scope and update time are
visible. Refresh, loading, error and zero-result states are explicit. No new
chart dependency is needed. Tests cover site scope, access, duplicate swimmers,
shared levels, calendar boundaries, waitlists, cancellation rosters and DST.

## Reception activity

`/analytics/reception` uses the same Analytics screen grant and sidebar site.
It counts the same actions as Overview, grouped by recorded actor ID, without
depending on a role name. Staff with activity appear in the table; search and
an expandable Monday–Sunday breakdown help inspect individual staff members.
Different people sharing a name stay separate while their accounts exist.
When an account has been deleted, its retained audit name groups the records.
Automatic withdrawals appear under Scheduled unenrolment when applied; the
audit currently has no scheduler ID on that action, so the report does not
invent attribution to the person who scheduled it.

## Instructor attendance

`/analytics/instructors` shows each weekly class occurrence in the current week
at the selected site. It is read-only and does not enter the Instructor workspace.
Class overview links are offered only with the Classes screen grant.

- The instructor who started a class is responsible for that occurrence; otherwise
  its current scheduled instructor is shown. Original instructor and cover remain
  visible, including retained names for deleted accounts.
- Attendance becomes due after the scheduled finish time in Europe/Dublin.
  In-progress and upcoming sessions do not count as missing. Dated cancellations
  and classes with no swimmers are excluded from the due denominator.
- Saved means every swimmer on the dated roster has a mark. Absent is a valid
  saved mark. Partial means some marks are saved; Not taken means none. Starting
  a class without saving attendance does not complete its register.
- Roster counts use enrolment dates (end dates are exclusive) and exclude waitlists
  and removed waitlist entries. Swimmers with existing dated attendance remain
  counted after a move or withdrawal. Duplicate enrolments do not multiply people.
  Current swimmer status does not erase historical attendance responsibilities.
- Saved by lists the names on the latest saved marks, with the latest timestamp
  and present/late/absent counts. A colleague's saves count as completed attendance
  for the class; this is a completion report, not a claim that the assigned teacher
  personally made every mark.
- Occurrences use the current weekly schedule and unstarted instructor assignment;
  the database has no historic weekly schedule snapshots. Classes created after
  an occurrence or archived before it are excluded. Started cover attribution
  remains date-specific. The report does not include assessment sessions.

The summary lists instructors with occurrences that week, including unassigned
classes. Select an instructor and use the class-status filters to inspect their
registers. Both report pages inherit the Analytics loading and error boundaries.
