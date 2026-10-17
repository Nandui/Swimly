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

## The suite (16 October 2026)

The pages are one suite (`components/navigation.tsx`, `ANALYTICS_GROUPS`): **The
business** (Overview, Classes, Swimmers, Progression), **Our people** (Teachers,
Reception) and **Checks** (Registers, Multiple enrolments). Each page opens with one
filter tray (`components/insights/filters.tsx`) and is split into named sections
(`Section` in `kit.tsx`) with "On this page" links. The look follows the
high-end-visual-design skill: ringed trays around white panels, spring easing and a
rise-in on load (switched off for reduced motion), all in `analytics.css`.

Filters, all carried from page to page by `reportQuery` (`server/period.ts`):

- **Custom dates**: `?from=YYYY-MM-DD&to=YYYY-MM-DD` beside the presets, with quick
  picks (last 30 days, this and last month, this and last school year from
  1 September, this and last year). The end is never after today, the period is at
  most three years, and it is compared with the same number of days just before.
  Weekly figures use the Mondays the period touches.
- When a custom period ends before today, "now" figures (swimmers, places filled,
  ages, stay curves) are read on its last day (`period.today`; `period.now` is the
  real today). Waiting lists, the next four weeks, swimmers who may leave and jobs
  still waiting are always as of today.
- **Programme**: `?programme=<id>` keeps one shared programme's classes, places,
  waiting lists, lessons, passes and skills (`server/programme-filter.ts`); a move
  into another programme reads as leaving this one. Assessment sessions are not tied
  to a programme, so only bookings placed elsewhere drop out. A single class's page
  and Reception ignore it.

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

The figures below describe the Registers (`/analytics/instructors`) and Multiple
enrolments reports. The earlier one-page dashboard was removed on 16 October 2026.

## Reception (round two, 16 October 2026)

`/analytics/reception` and `/analytics/reception/[key]` (one person, keyed like
teachers: `staff:<id>` or `name:<name>`) measure the desk's work in Turnfin, per
person and per site, with the same period and site choice and the same Manage-only
access as the other reports. Phone calls, emails and the till are not recorded, so
they are not counted.

- **Work done** comes from the audit log through Core (`auditWorkload` in
  `src/lib/audit.ts`), for the Swim school, Short courses and Refunds modules,
  mapped to kinds of desk work by `workKind` (`server/desk.ts`). Teaching and set-up
  are left out. Busy hours use Irish local time.
- **Timed jobs** have a start, an end and a target (`JOB_KINDS`): parent detail
  changes and app links (24 h), billing agreement checks (7 days), cancelled classes
  to billing (2 days), ready to move (14 days, from the teacher's mark to the next
  place), waiting list to a place (no target, from the log), and from other modules
  through `registerDeskMeasures` in `src/modules/contributions.ts`: Academy call backs
  (Short courses, 72 h, `callBy`) and refund requests sent (Refunds, no target).
  Still waiting is late once past its target.
- **Record quality**: new swimmers added without a date of birth, contact phone or
  emergency phone (yes/no only, never the details); unenrols with no reason (from
  16 October 2026, when the reason was first asked); places made then unenrolled
  within 24 hours, against whoever made them.
- **Follow-ups** (`StudentFollowUp`) by outcome and channel, with swimmers past
  their next contact date; **assessment bookings** by who booked them, no-shows and
  how many assessed swimmers started a class within two months.
- Swimmers belong to no site, so new swimmers count for people who did desk work at
  the chosen sites; parent app link requests are not site-bound either.

## More swim school figures (round two)

Pure functions in `server/extras.ts`, tested in `extras.test.ts`:

- **Stay curves** (Swimmers): of new swimmers who joined in each of the last six
  quarters, the share still swimming after 4, 8, 13, 26 and 52 weeks, counting only
  those who joined long enough ago; the top row covers the last two years.
- **Parents in the app** (Swimmers): swimmers here today with a parent linked
  (`ParentChildAccess`, not revoked), and those first linked in the period.
- **The next four weeks** (Classes): places booked on each coming week against
  capacity, with places starting and ending in between. New joiners are not guessed.
- **Attendance by time slot** (Classes), **cancelled lessons** with the swimmer
  places affected and reasons, and **same teacher each week**: the share of each
  class's lessons taught by its most frequent teacher (also a Teachers figure).
- **Assessment to first lesson** (Progression): median days for those who started
  within two months.
- **Overview** lists reception jobs past their target (`server/desk-overdue.ts`).

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
