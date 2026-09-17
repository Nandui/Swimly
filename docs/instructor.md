# Instructor

Instructor is the isolated shadcn workspace for instructors using tablets at
the pool. Its route group and layout stay separate from the desk workspace.

- /instructor shows My classes or All classes at the working site today,
  grouped by time or level. The list refreshes every minute while visible and
  offers manual refresh.
- **Assessments today** shows all non-cancelled assessment sessions at the working
  site, including unassigned sessions and days without weekly classes. It sits
  above the weekly class filters, so My/All classes and Time/Level do not hide it.
  Each row shows time, pool, programme, assessor and bookings/capacity.
- **Open assessment** stays under `/instructor/assessments/[id]` and requires
  `assessments.run`. The loader restricts bookings to today's non-cancelled
  sessions at the selected site before reading the roster. Instructors can
  record placements or no-shows using the existing permission-checked, locked,
  audited assessment actions. Assessments use this existing assessor permission;
  weekly classes retain their separate dated start confirmation.
  No swimmer profiles, booking administration or desk navigation appear here.
- An unclaimed class offers **Start class**. A shadcn dialog asks the instructor
  to confirm they are at the pool and teaching it, including their own class.
- Confirmation records the first start for that class and date. All authorised
  instructors then see **Open class**, with **Attendance saved** or **Attendance
  to take**. Colleagues can open the roster and help with attendance, competencies
  and level completion within their own permissions. Shared rows identify who
  started the session; a later open never replaces the original start record.
- /instructor/classes/[id] contains attendance, then competencies and eligible
  level completion. Returning preserves My/All and the grouping choice.
- Competencies opens directly into the swimmer list. Tap a name to expand that
  swimmer's class-level competencies; opening another closes the previous row.
  Mark results individually or use **Mark all achieved** for that swimmer.
  All swimmers share drafts and one **Save marks** action across the class.
  Switching swimmers keeps unsaved changes. Absent swimmers remain
  under **Not in today**; level completion is still a separate confirmation.
- The frame offers classes, site, appearance and sign-out. It has no desk
  sidebar, global swimmer search, class administration or swimmer-profile links.
  The desk navigation never leads into Instructor.

The class list, confirmation, teaching forms, notices and completion dialog use
actual shadcn components from src/components/shadcn, with Neutral ui-* tokens,
keyboard-operable radio groups and touch targets of at least 44px. Notifications
sit above the teaching area so they cannot cover Save or Done.

Access requires the Instructor screen and attendance.mark. Starting another
instructor's class also requires attendance.cover. Competency marking and level
completion retain progression.assess and progression.complete respectively.
Existing screen grants are unchanged. Accounts explicitly granted both
workspaces can access both; their normal navigation remains separate.

The existing ClassCover table records confirmed starts for scheduled teachers
as well as substitutes; no database migration is required. A course row lock,
unique course/date key and insert-only start preserve the first confirmation.
Concurrent starts both succeed but produce only one start record and audit.
All existing starts allow shared access, including when the original teacher's
account has been deleted. No migration or live data reset is required.

The Instructor loader checks the start before reading swimmer data. Attendance,
competency and completion actions recheck it under the course lock.
Competency writes also verify current enrolment for the date and the class's
shared curriculum level. Desk-only actions cannot bypass these checks for an
instructor-only account. Explicit desk transcription permissions still permit
corrections through the separate desk workspace.

Class/date draft keys, save retries, saved-register comparisons, original
recorder attribution and audit transactions are preserved. Old deck bookmarks
redirect to the isolated class route while retaining date and teaching step.

Verification uses synthetic swimmers and mocked server boundaries; no live
records are created or changed. Typecheck, lint and production compilation pass.
Automated tests cover one-record concurrent starts, repeat confirmations, shared
access, deleted original instructors, direct access before roster reads, stale saves,
changed enrolments and levels, desk-action bypasses and audit rollback.
Browser checks cover 375, 768, 1024 and 1280px in light and dark with one H1,
no horizontal overflow and 44px controls. Own-class and substitute starts,
attendance failure/retry, draft recovery, competency save/return, keyboard
selection and shared session links are exercised using local-only fixtures.

`scripts/check-instructor-swimmers.mjs` verifies the real teaching components
with fictional swimmers and mocked save actions, rejecting all outbound requests.
It covers opening names, shared drafts, swimmer-only bulk marking, recovery,
failed saves and retries, the save payload, read-only access, absent swimmers,
empty states, keyboard controls and both themes at the four supported widths.
Set `INSTRUCTOR_PLAYWRIGHT_MODULE` to a Playwright module path when it is not
installed locally. Run `node scripts/instructor-swimmer-preview/build.mjs --serve`
for the isolated interactive preview on port 4190. Neither command uses live data.

`scripts/check-instructor-assessments.mjs` exercises the actual Instructor home
and assessment components with fictional sessions and mocked server boundaries.
It covers visibility across My/All classes and permissions, unassigned sessions,
assessment-only days, isolated navigation, placement/no-show saves and retries,
empty states and 16 light/dark layouts. Dialog controls remain at least 44px.
Run `node scripts/instructor-swimmer-preview/assessment-build.mjs --serve-assessments`
for the synthetic assessment preview on port 4191. No live records are read or changed.
