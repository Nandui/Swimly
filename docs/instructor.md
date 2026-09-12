# Instructor

Instructor is the isolated shadcn workspace for instructors using tablets at
the pool. Its route group and layout stay separate from the desk workspace.

- /instructor shows My classes or All classes at the working site today,
  grouped by time or level. The list refreshes every minute while visible and
  offers manual refresh.
- An unclaimed class offers **Start class**. A shadcn dialog asks the instructor
  to confirm they are at the pool and teaching it, including their own class.
- Confirmation claims that class and date. The owner subsequently sees
  **Open class**, with plain **Attendance saved** or **Attendance to take**.
- Other instructors see **In progress** and the teacher's name. They cannot
  open the roster, attendance or competencies, including through a bookmark.
- /instructor/classes/[id] contains attendance, then competencies and eligible
  level completion. Returning preserves My/All and the grouping choice.
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
unique course/date key and insert-only claim make simultaneous starts a
single-winner operation. An owner's retry succeeds without another audit.
Another teacher cannot overwrite the claim, including when the original
teacher's account has been deleted. Claims persist for that date.

The Instructor loader checks the claim before reading swimmer data. Attendance,
competency and completion actions recheck the owner under the course lock.
Competency writes also verify current enrolment for the date and the class's
shared curriculum level. Desk-only actions cannot bypass these checks for an
instructor-only account. Explicit desk transcription permissions still permit
corrections through the separate desk workspace.

Class/date draft keys, save retries, saved-register comparisons, original
recorder attribution and audit transactions are preserved. Old deck bookmarks
redirect to the isolated class route while retaining date and teaching step.

Verification uses synthetic swimmers and mocked server boundaries; no live
records are created or changed. Typecheck, lint and production compilation pass.
Automated tests cover single-winner claims, repeat confirmations, rejected
ownership, deleted owners, direct access before roster reads, stale saves,
changed enrolments and levels, desk-action bypasses and audit rollback.
Browser checks cover 375, 768, 1024 and 1280px in light and dark with one H1,
no horizontal overflow and 44px controls. Own-class and substitute starts,
attendance failure/retry, draft recovery, competency save/return, keyboard
selection and locked direct URLs were exercised using the local-only fixture.
