# Today’s classes

Today has one purpose: check all of the current club’s classes for today.
The owner chose time slots as the columns. Each exact start time owns a
column, with its classes in curriculum order. Columns wrap in chronological
reading order as the available width decreases; all classes remain visible.
There is no horizontal scrolling, pagination, or fold hiding earlier classes.

Each class shows its level/name, start and end, pool area, instructor or
declared cover, occupied and available places, and recorded attendance status.
Longer classes keep their actual end time. Only a saved attendance record
counts as attendance taken. Weekly classes are the scope; dated assessment
sessions stay on Assessments.

All instructors and pool areas are selected initially. Filters include My
classes and declared cover. Clear filters restores the whole day. Jump to now
focuses the first slot with a running class, or the next start when none is
running. Refresh preserves filters. Visible pages refresh every minute and
on focus; an open picker postpones the refresh. Dates and the clock use
Europe/Dublin. A page crossing midnight withholds the old classes until the
new day loads.

The role must offer Today. Viewing its calendar does not require attendance
permission. Class links open attendance only when that permission is held;
otherwise they open class details when the Classes screen is available.
Calendar-only users see the timetable without links to inaccessible screens.
Existing attendance, cover and competency actions keep their own guards.
No mutations are added here, and no swimmer or contact records are loaded.

## Instructor and existing roles

The original Today deck page is retained at `/instructor`, titled Instructor.
Its My classes / All classes, time / level grouping, next-class emphasis,
earlier-class fold and cover workflow are retained. Both destinations appear
separately in navigation and role configuration.

The screen keys are `calendar` (Today) and `instructor` (Instructor). Existing
roles with the retired `today` key resolve to both; Instructor still requires
attendance permission. An existing `today` landing-page key continues to open
Instructor. Role forms show the explicit choices and save those keys through
the existing audited actions, so administrators can subsequently remove either
screen independently. This compatibility needs no database migration or script.

Class links carry a validated `from=today` or `from=instructor` value. Back,
week navigation, attendance-to-competencies and the final Done action preserve
that origin. An inaccessible or unrecognised origin falls back to an accessible
screen. Attendance and enrolment actions revalidate both destinations.

## Direction contract

THESIS: one complete day, organised by class start time.

OWN-WORLD: the installed Astryx Neutral components, Figtree and existing shell.
Time headers and divided class rows carry the hierarchy in both colour modes.

STORY: find a time, check its classes and availability, then open the class
when attendance or further detail is needed.

FIRST VIEWPORT: date and club, a compact filter row, then time-slot columns.
Running and next starts are labelled. Refresh and Jump to now sit in the header.

FORM: code-led extension of Today. The owner specified time-slot columns;
no concept roll or replacement visual identity is needed.

FINISH: verify filtering, timing, access and the responsive calendar using
synthetic examples, then record the checks and preserve DESIGN.md.

## Verification

- Typecheck and lint pass. All 124 tests pass, including exact time grouping,
  mixed durations, cover filtering, legacy role compatibility, independent
  screen access and safe return destinations.
- The real calendar and AppShell were rendered with synthetic data. Browser
  checks cover filtering, refresh, no-match recovery, keyboard focus, class
  destinations, missing details and Dublin midnight. No database writes ran.
- The restored Instructor page passed browser checks for My classes / All
  classes, earlier classes, level grouping and attendance links. Its layout
  was also checked at all four widths in both colour modes.
- Checked at 375, 768, 1024 and 1280 in both light and dark: one H1 and main,
  no horizontal overflow or nested controls, and 44px touch targets. Long
  class, location and instructor names were also checked.
- Review captures and the runnable fixture are in the ignored directory
  `.impeccable/review/today/`. These show synthetic examples, not live records.
- Review was performed in this task, following the project's instruction not
  to delegate. The one Impeccable detector pass reported no findings. The
  installed component imports, typography, spacing and status tokens were
  checked against DESIGN.md and globals.css; neither system file changed.
- Live database rendering, production build and deployment were not run.
