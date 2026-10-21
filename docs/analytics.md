# Analytics

`/analytics` is the swim school's reports, for managers only (owner decision, 21 October
2026): the **Analytics** module in the Managers group, one level, **View** (the `analytics`
screen, `analytics.view`, at the person's sites). Swim school Manage no longer opens it. Code: `src/modules/activities/features/analytics`
(`server/insight-queries.ts` reads, `server/swimmers.ts`, `server/teaching.ts` and
`server/insights.ts` compute, `components/insights/` draws). Styles are in
`src/app/(activities)/analytics/analytics.css`.

## System place changes (owner request, 21 October 2026)

An account can be marked as system (`User.actsAsSystem`, set by a superadmin with **Mark
place changes as system** on its Staff page; Fernando Serina's account is marked by the
`20261202120000_system_place_changes` migration). Its enrolments, waitlistings, moves and
unenrolments (`PLACE_CHANGE_ACTIONS` in `src/lib/audit.ts`) are logged with
`AuditLog.system`, shown as "System - scripted action done via development" (Activity,
module trails, swimmer history) and left out of analytics: `auditWorkload` skips them,
`auditEvents` returns them marked and the Reception report drops them, the Overview's
enrolled/unenrolled counts skip them, and a place started or ended by one
(`PlaceRow.systemStart` / `systemEnd`) is not a join, leaver or class move. The place itself
still counts while held (swimmers, places, % full, retention). Marking also marks the
account's earlier entries; unmarking only affects new ones. Rows are never deleted.

## Reports (October 2026)

Every report takes `?range=4w|13w|26w|52w` (default 13 weeks, starting on a Monday)
and `?sites=all` (every site the person works at; default the working site), and
compares with the same length of time just before.

## Three dashboards (19 October 2026)

The owner asked for analytics "for the business decisions, another for the reception so
the supervisor can performance manage the people managing it, and another for the pool
deck supervisor". So the suite is three dashboards (`components/navigation.tsx`,
`DASHBOARDS`), switched by three links at the start of the one sticky bar under the
title (`DashboardSwitch`), with the filters after them. The app's own bar and rail are
the only menus. Every other page sits behind one dashboard (`ANALYTICS_PAGES`) and has a
link back to it:

- **Business** (`/analytics`, `getBusinessInsights`): behind it Every class
  (`/analytics/classes`), Swimmers and leavers (`/analytics/swimmers`) and Multiple
  enrolments.
- **Reception** (`/analytics/reception`): behind it each person (`/analytics/reception/[key]`).
- **Pool deck** (`/analytics/pool-deck`, `getPoolDeckInsights`): behind it each teacher
  (`/analytics/teachers/[key]`), Level by level (`/analytics/progression`) and Registers
  (`/analytics/instructors`). `/analytics/teachers` redirects to the pool deck's teacher
  table, keeping its filters.

All three need Analytics View (the `analytics` screen). They follow the mockups the
owner approved on 20 October 2026, in Turnfin's Poolside look (`analytics.css`: white
panels, pills, one blue for data, an orange second series validated against it). Each
opens with Worth a look first, then headline tiles that each switch one chart
(`components/insights/switches.tsx`, `TileSwitch`) with the same weeks of the period
before (`overview.trend[].before`, `desk.weekly[].before`) and a plain sentence. People
are compared one measure at a time (`PillSwitch` + `CompareList` in `blocks.tsx`): a bar
each against the team or school average, orange with a reason when worth a word; the
full table stays under "Show everyone as a table". Places filled week by week is
measured against today's classes; the waiting list has no history, so its tile shows
today's list by level.

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

- **Business** (`/analytics`): worth a look first (full classes with a waiting list,
  classes under half full, swimmers who may leave, leaving soon); tiles for swimmers,
  joined, left, places filled and waiting, each with its chart; a day × class start time heat
  map of places filled with a dot where someone waits (pressing a slot opens its levels,
  grouped by programme, with places filled, free and waiting and links to each class),
  beside the full and nearly empty classes; places at each level (owner, 21 October 2026:
  every level's bar is its own places at full width, the filled share in blue, with its
  % full at the end of the row and anyone waiting in amber; an opened slot's levels use
  the same `PlacesRow`); who left by reason or level; assessments to places;
  the next four weeks; ages.
- **Reception** (`/analytics/reception`): worth a look first; tiles for jobs done, on
  time, still waiting, new swimmers complete, unenrols with a reason and undone in a
  day; the team one measure at a time; how fast the desk answers; still waiting; record
  quality; work by kind against the period before; busy hours; follow-up calls;
  assessment bookings.
- **Every class** (`/analytics/classes`, `/analytics/classes/[id]`): fill, free places,
  waiting list and lessons held, then every class; a class shows its swimmers'
  attendance, last lessons and skills, its waiting list, leavers and every lesson with
  who started it.
- **Swimmers and leavers** (`/analytics/swimmers`): month-by-month joiners and leavers
  and drop-off, reasons, tenure, level left from, ages, parents in the app, swimmers who
  may leave, leaving soon and every leaver.
- **Pool deck** (`/analytics/pool-deck`): tiles for attendance, started on time,
  registers complete, same teacher each week, skills ticked and level passes, each with
  its chart; worth a look first (registers not done this week, lessons with no start record,
  teachers more than 10 points worse than the school, swimmers over 6 months at a
  level); registers this week; attendance by time slot; same teacher each week;
  cancelled lessons; every teacher one measure at a time against the school; weeks to pass each level; the
  skill holding each level back.
- **Level by level** (`/analytics/progression`): per level the swimmers, passes, the
  median weeks to pass, skills done, the hardest skill and swimmers over 26 weeks at
  one level; assessments and how many went on to take a place within 30 days.
- **Teachers** (`/analytics/teachers/[key]`): per teacher, lessons, cover, missed
  starts, attendance, on-time starts (within 5 minutes), registers complete, skills
  ticked, passes and leavers, against the school.

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
- **The next four weeks** (Business): places booked on each coming week against
  capacity, with places starting and ending in between. New joiners are not guessed.
- **Attendance by time slot** (Pool deck), **cancelled lessons** with the swimmer
  places affected and reasons, and **same teacher each week**: the share of each
  class's lessons taught by its most frequent teacher (Pool deck).
- **Assessment to first lesson** (Business and Level by level): median days for those who started
  within two months.
- Reception jobs past their target are on Reception (Still waiting). `server/desk-overdue.ts`
  is no longer read by any page.

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
