# Today’s classes

Today has one purpose: check all of the current club’s classes for today.
The owner selected the level-led booking sheet (design option 2). Exact start
times run across the top; levels run down the left, grouped by programme in
curriculum order. A cell shows every class at that level and start, ordered by
pool area. Empty cells show a quiet dash with accessible “No class” text. Level and programme IDs distinguish
records with the same name. Filters remove rows without matching classes.

The sheet measures the space available inside the shell: a 136px level column
and at least 144px per time column. One continuous sheet scrolls within its
bounded region, keeping time headers and level labels visible. Staff can
switch between Booking sheet and Agenda. Below 600px of working space,
classes use Agenda automatically. Sidebar resizing updates the layout;
all classes remain reachable, and longer labels wrap rather than truncate.
There is no pagination or fold hiding earlier classes.

Each class shows its level/name, start and end, pool area, instructor or
declared cover, occupied and available places. A circled check means spaces
are available; a circled X means full, replacing the Full pill. Both icons
have accessible descriptions and a visible legend. Null capacity means
uncapped and therefore available. Over-capacity classes use the full icon
with an explicit over-capacity count. Attendance-completion markers are not
shown. Longer classes keep their actual end time. Weekly classes are the scope; dated assessment
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

THESIS: compare one complete day by level and class start time.

OWN-WORLD: a shadcn-derived table and booking blocks within the existing
Astryx Neutral shell and Figtree typography. A CSS Module scopes the approved
calendar styles; the filters and shared controls retain Astryx. DESIGN.md
records this screen-specific exception, including scrolling and capacity icons.

STORY: find a level and time, check its classes and availability, then open the class
when attendance or further detail is needed.

FIRST VIEWPORT: date and club above the filter toolbar, then the booking sheet.
Running and next starts are labelled. Refresh and Jump to now sit in the header.

FORM: the selected level-led design implemented in the existing Today page,
using the current shell, type scale and Neutral theme.

FINISH: verify filtering, timing, access and the responsive calendar using
synthetic examples, then record the checks against DESIGN.md's approved exception.

## Verification

- Typecheck and lint pass. All 127 tests pass, including the seven calendar checks.
- The booking-sheet checks cover curriculum ordering, same-name levels in
  different programmes, simultaneous classes, exact times, mixed durations,
  filtering, declared cover and permission-sensitive destinations.
- The real calendar and AppShell were rendered with synthetic data. Browser
  checks cover filtering, refresh, no-match recovery, keyboard focus, class
  destinations, missing details and Dublin midnight. No database writes ran.
- Instructor, attendance actions and database queries were not changed.
- Checked at 375, 768, 1024 and 1280 in both light and dark: one H1 and main,
  no overflow outside the sheet or nested controls, and 44px touch targets. Long
  class, location and instructor names were also checked.
- Review captures and the runnable fixture are in the ignored directory
  `.impeccable/review/today-refined/`. These show synthetic examples,
  not live records. `design-qa.md` records the approved-preview comparison.
- Review was performed without delegation. Component APIs, typography, spacing
  and status tokens follow the shared Neutral theme. DESIGN.md records the
  approved shadcn exception; the global stylesheet did not change.
- `npx next build` passes. Live database rendering and register writes were
  not exercised. The application's migration-running build script was not used.
