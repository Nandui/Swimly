# Find and inspect classes

The `/courses` screen is the weekly class directory across all live sites,
redesigned with owner-approved shadcn components. It starts with all active
classes, ordered by weekday, start time and curriculum order. Each row is one
profile link, showing the level/programme, site/pool, weekly schedule, instructor
on wide screens and available places. Phones stack the class identity above its
schedule and capacity. Circled check/X icons mean spaces available/full; attendance
completion does not affect the signal. Archived rows show their archive state.

Search matches words across class name, level, programme, site, weekday, start
time and instructor. Site, Level and Day filters stay visible; More filters
reveals Programme, Time, Instructor and Pool area. Each picker option's count
accounts for every other filter. The All classes, Spaces available, Full and
Archived links show whole-directory counts. The result count reflects all applied
filters. Twenty-four results appear per page; changing a filter resets the page.
“Today only” narrows the existing search to today's weekday. “Refresh” reloads
current data. Clear actions remove individual filters or recover from no results.

The Add class dialog uses shadcn and explicitly names the current working site.
Searching another site does not change the device's working site. Required-level
validation, pending controls, retained fields on failure and a scrollable form
body keep creation usable on phones. It calls the existing permission-checked,
audited action; no live writes are used for design verification.

“View class” opens `/courses/[id]`. The class page shows schedule, instructor,
pool area and capacity, followed by enrolled swimmers and a separate waitlist.
Swimmer rows include member number, age when recorded, pinned placement level
and programme, placement reason and any scheduled unenrolment. Medical notes
are indicated, not displayed in the roster. The Classes breadcrumb preserves
the browser's search, filters, archive state and page. Its return URL only
accepts `/courses` and known browser parameters, including the site filter.

## Access and data

- Both pages require the Classes screen before querying.
- The directory reads both live sites without downloading rosters. Archived
  curriculum is retained for historical directory records; active enrolment
  pickers still exclude retired levels. Class inspection reads the selected
  class and its roster regardless of the swimmer's registration site. Cover
  on inspection is looked up by class and date, including other sites.
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
and all-site directory reads. Existing class and enrolment action tests cover capacity,
placement, confirmations and atomic audit behaviour.

Browser verification uses the actual directory, Add dialog and app shell with
synthetic data and isolated action doubles in the ignored
`.impeccable/review/classes-shadcn` fixture. Check searching, selecting a site or pool area,
opening and returning from inspection, pagination, Today only, refresh, empty
results, archive/read-only states, inactive swimmers, dialog cancel/focus return
and save failure recovery. Check the directory at 375, 768, 1024 and 1280 in light
and dark mode, including touch targets, overflow, landmarks and keyboard focus.
These checks do not modify shared database records.

The shadcn redesign passed `npm run typecheck`, `npm run lint`, all 145 tests
and `npx next build`. Synthetic browser checks covered combined site/search/
availability filters, return links, pagination, archived and empty results,
required fields, simulated save failure/retry, and all four widths in both
modes. Live checks confirmed the directory contains no Astryx elements, class
links resolve, filtered return links survive, and Refresh retains the filters.
