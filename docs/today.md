# Today’s schedule

Today has one purpose: check all of the current club’s classes and assessments for today.
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
shown. Longer classes keep their actual end time.

Agenda combines weekly classes with assessment sessions dated today, in exact
start-time order, retaining simultaneous sessions of either type. Cancelled
assessment sessions are excluded; sessions with no bookings remain visible.
Assessment Items show a neutral Assessment label, kind/programme, pool,
instructor, start/end and occupied/free places using the same capacity icons.
The booking sheet keeps its class/level geometry and offers View in agenda when
assessments are scheduled. Assessment-only days open Agenda automatically.

All instructors and pool areas are selected initially. Both session types
contribute filter choices. My schedule includes assigned classes, declared
cover and assigned assessments. Clear filters restores the whole day. Jump to
now focuses the first running slot in the current view, or the next start when
none is running. Refresh preserves filters. Visible pages refresh every minute and
on focus; an open picker postpones the refresh. Dates and the clock use
Europe/Dublin. A page crossing midnight withholds the old schedule until the
new day loads.

The role must offer Today. Viewing its calendar does not require attendance
permission. Class links open attendance only when that permission is held;
otherwise they open class details when the Classes screen is available.
Calendar-only users see the timetable without links to inaccessible screens.
Assessment links open the session only when the role offers Assessments. The
query selects schedule fields and seat-holding booking counts only, scoped to
the current club and date; it loads no participant identities or notes. Session
creation, rescheduling, cancellation, type changes and booking changes invalidate Today.
Existing attendance, cover and competency actions keep their own guards.
No mutations are added here, and no swimmer or contact records are loaded.

Assessment agenda verification (12 September 2026): the 13 focused Today tests
cover date/site/cancellation query constraints, minimal data selection, booking
counts, curriculum fallbacks, mixed and simultaneous sessions, filters and
permission-aware links. Synthetic browser checks cover 375, 768, 1024 and 1280
in light and dark without page overflow, assessment-only and empty days,
calendar-only access, combined filters, and keyboard focus after the agenda
shortcut and Jump to now. Live `/today` renders successfully. No test records
were written to the shared database.

## Instructor and existing roles

Instructor is an isolated tablet workspace at `/instructor`, requiring a
confirmed class start before teaching records can be opened or changed. It
does not appear in desk navigation, and desk links do not appear there.
The screen keys are `calendar` (Today) and `instructor` (Instructor). Legacy
deck-only roles keep Instructor without gaining Today. See [Instructor](instructor.md)
for workspace boundaries and claim enforcement.

Class links carry a validated `from=today` or `from=instructor` value. Back,
week navigation, attendance-to-competencies and the final Done action preserve
that origin. An inaccessible or unrecognised origin falls back to an accessible
screen. Attendance and enrolment actions revalidate both destinations.

## Direction contract

THESIS: compare one complete day by level and class start time.

OWN-WORLD: shadcn Table and Item booking blocks, filters, actions, view tabs,
labels and empty/loading states within a shadcn workspace. Figtree remains;
independent Neutral tokens and namespaced utilities support light and dark.
The CSS Module scopes the approved calendar geometry. DESIGN.md records
the migration of Today and shared chrome, including scrolling and capacity icons.

STORY: find a level and time, check its classes and availability, then open the class
when attendance or further detail is needed.

FIRST VIEWPORT: date and club above the filter toolbar, then the booking sheet.
Running and next starts are labelled. Refresh and Jump to now sit in the header.

FORM: the selected level-led design implemented in the existing Today page,
using the current shell, type scale and Neutral theme.

FINISH: verify filtering, timing, access and the responsive calendar using
synthetic examples, then record the checks against DESIGN.md's approved exception.

## Booking-sheet verification (before the full shadcn migration)

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

## Full shadcn migration verification — 11 September 2026

- `npm run typecheck`, `npm run lint`, all 136 tests, and `npx next build`
  passed. No migration or live record writes were run.
- Browser checks on Today at 375, 768, 1024 and 1280, light and dark: all
  classes retained, one H1, no document overflow, and no Astryx DOM elements.
  Narrow surfaces use Agenda. Controls and navigation meet 44px touch sizing.
- Pool/instructor filtering, searchable instructor options, no-match recovery,
  clearing filters and refresh preserving the selected pool passed.
- shadcn Tabs switch between Booking sheet and Agenda. Availability icons,
  counts, cover labels and permission-derived destinations remain intact.
- Workspace search opens its labelled dialog, focuses its input, handles a
  nonmatching test query, and closes with Escape. No real swimmer results
  were included in screenshots or exported artifacts.
- Mobile navigation opens and dismisses with Escape. The collapsed sidebar
  survives reload; its Setup menu and site/account/role menus open correctly.
  Menu inspection did not invoke sign-out, role changes or site changes.
- Classes renders within the migrated shell in both themes. Its body remains
  Astryx. The Today/shared UI migration does not remove legacy app dependencies.
- The optimized Turbopack build passed. The local dev server uses Next's
  `--webpack` mode after Turbopack repeatedly reported an HMR graph error.
  The project's default build and dev scripts are unchanged.
