# Today’s schedule

Today has one purpose: check all of the current club’s classes and assessments for today.
The owner selected the level-led booking sheet (design option 2). Exact start
times run across the top; levels run down the left, grouped by programme in
curriculum order. A cell shows every class at that level and start, ordered by
pool area. Empty cells show a quiet dash with accessible “No class” text. Level and programme IDs distinguish
records with the same name. Filters remove rows without matching classes.

The page follows V2Schedule: a PageHeader (the day and site, an outline
Refresh and, on today only, a primary Jump to now or Jump to next), then one
white panel holding everything else. Its first row is the week: outline
previous and next week buttons, seven day tiles (weekday over the date, the
chosen day filled blue, the real today marked `aria-current="date"`) and an
outline Today button, with the Booking sheet / Agenda toggle on the right.
Below 1024px the buttons take their own row and the seven days a full-width
grid, so no day is ever hidden in a scroll. Summary tags with icons follow
(classes, assessments, running now, coming up), then an info Notice when
assessments are also scheduled, with View in agenda.

The sheet uses a 136px level column and fixed 144px time columns, and is only
as wide as they need. It scrolls across times inside the panel, keeping time
headers and level labels visible. The header cell reads "Level and time"; a
time header gives the start and its class count, "On now · 1 class" for the
running start and "Next · 2 classes" for the next one. Staff can switch
between Booking sheet and Agenda. Below 600px of working space, classes use
Agenda automatically. All classes remain reachable, and longer labels wrap
rather than truncate. There is no pagination or fold hiding earlier classes.

Each class is a shared time block (`.pc-block`) coloured by its state, keyed
like the home timeline and the duty list (`sessionState`, `HOME_SESSION_META`):
running now, coming up, finished, cancelled, or cover needed when nobody is
teaching it. A declared substitute keeps the class's colour and reads
"Name (cover)". A future day's classes are neutral blocks. The block shows
the instructor, the pool area with occupied/capacity places (the course name
too when it differs from the level), and one tag with an icon: a circled
check for "2 free" or "No limit" (null capacity is uncapped), a circled X for
"Full" or an explicit "2 over" count. Full never changes the block's colour.
The tag carries the longer description as its tooltip and in the block's
accessible name, so there is no separate legend. In Agenda each block also
shows the course name and its start and end. Attendance-completion markers
are not shown.

Agenda combines weekly classes with assessment sessions dated today, in exact
start-time order, retaining simultaneous sessions of either type. Cancelled
assessment sessions are excluded; sessions with no bookings remain visible.
Assessment blocks use the purple assessment state and its Assessment tag, with
kind/programme, pool, instructor, start/end, bookings and the same places tag.
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
  classes retained, one H1, no document overflow, and no legacy UI DOM elements.
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
  legacy UI. The Today/shared UI migration does not remove legacy app dependencies.
- The optimized Turbopack build passed. The local dev server uses Next's
  `--webpack` mode after Turbopack repeatedly reported an HMR graph error.
  The project's default build and dev scripts are unchanged.
