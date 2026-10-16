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
activity and Multiple enrolments reports. The earlier one-page dashboard was removed on 16 October 2026.

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
