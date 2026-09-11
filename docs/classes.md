# Find and inspect classes

The existing `/courses` screen is the weekly class browser. It starts with all
active classes, ordered by weekday, start time and curriculum order. Results
show the level/programme, pool area, time, instructor and available places.
Declared cover and register completion appear only for classes running today.

Search combines with programme, level, day, time, instructor, pool area and
places filters. Each option's count accounts for every other filter. Archived
classes have separate results. Twenty-four results appear per page; changing a
filter resets the page. “Today only” narrows the existing search to today's day.
“Refresh” reloads current data.

“View class” opens `/courses/[id]`. The class page shows schedule, instructor,
pool area and capacity, followed by enrolled swimmers and a separate waitlist.
Swimmer rows include member number, age when recorded, pinned placement level
and programme, placement reason and any scheduled unenrolment. Medical notes
are indicated, not displayed in the roster. The Classes breadcrumb preserves
the browser's search, filters, archive state and page. Its return URL only
accepts `/courses` and known browser parameters.

## Access and data

- Both pages require the Classes screen before querying.
- Class lists, cover and rosters are scoped to the selected club. Roster reads
  constrain both the class and swimmer to that club after authentication.
- Swimmer profile links require the Swimmers screen. Class management requires
  `courses.manage`; enrolment actions require `enrolment.manage`; attendance
  requires `attendance.mark`.
- Archived classes cannot receive new enrolments. Inactive swimmers are not
  offered transfers or promotion from the waitlist.
- All writes reuse existing actions, seat locks, audit and confirmation flows.
  The class browser does not load swimmers; the roster loads on inspection.
  No schema changes or data imports are required.

## Verification

Focused tests cover week/archive results, combined filters and facet counts,
uncapped/full availability, stable pagination, safe return URLs, authorization
and club isolation. Existing class and enrolment action tests cover capacity,
placement, confirmations and atomic audit behaviour.

Browser verification uses the actual components and app shell with synthetic
data and isolated action doubles. Check searching, selecting a pool area,
opening and returning from inspection, pagination, Today only, refresh, empty
results, archive/read-only states, inactive swimmers, dialog cancel/focus return
and edit failure recovery. Check both pages at 375, 768, 1024 and 1280 in light
and dark mode, including touch targets, overflow, landmarks and keyboard focus.
These checks do not modify shared database records.
