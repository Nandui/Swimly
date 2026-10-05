# Find and inspect classes

The `/courses` screen is the weekly class directory across all live sites,
redesigned with owner-approved shadcn components. It starts with all active
classes, ordered by weekday, start time and curriculum order. Each row is one
profile link, showing the level/programme, site/pool, weekly schedule, instructor
on wide screens and available places. Phones stack the class identity above its
schedule and capacity. Availability is one tag from `CAPACITY_META`: a green
circled check ("3 places left" or "Available"), an orange circled X ("Full") or
red "N over"; the enrolment count sits under it as a caption. The class page and
the Schedule use the same metas. Attendance completion does not affect the
signal. Archived rows show the Archived tag, and a class with no instructor shows
the "Not assigned" warning tag.

Everything sits in one list panel under the page header (Poolside Clear v2,
V2Classes): the "Find a class" search beside the All classes / Spaces available /
Full / Archived lenses, one wrapping row of filter pills, the result caption with
"Today only", the rows and the pager. Search matches words across class name,
level, programme, site, weekday, start time and instructor; Enter searches. Site,
Level and Day pills stay visible ("Site All sites"); More filters adds Programme,
Time, Instructor and Pool area pills to the same row. Each picker option's count
accounts for every other filter. The lenses show whole-directory counts. The
result caption ("1 to 24 of 84 classes") reflects all applied filters.
Twenty-four results appear per page; changing a filter resets the page.
“Today only” narrows the existing search to today's weekday. “Clear filters”
resets the filters, and the no-results state offers "Show all classes".

The Add class dialog uses shadcn and explicitly names the current working site.
Searching another site does not change the device's working site. Required-level
validation, pending controls, retained fields on failure and a scrollable form
body keep creation usable on phones. It calls the existing permission-checked,
audited action; no live writes are used for design verification.

“View class” opens `/courses/[id]` (SSClassDetail). Four white fact tiles show
schedule, pool area, instructor and places; then Enrolled swimmers, Waitlist and
Manage class are each a panel with its heading and actions ("Attendance and
progress" in the Enrolled head; Archive and Edit in Manage class). Swimmer rows
include initials, member number, age when recorded, pinned placement level and
programme, placement reason and any scheduled unenrolment. Below 1024px the
roster is closed rows with the actions at the end; from 1024px it is a table with
every column. Row actions are labelled outline buttons ("Move swimmer",
"Unenrol"; "Enrol from waitlist" is the primary). Unenrol keeps its dialog with
Now / On a date / Keep place; Archive and Restore ask for confirmation. Medical
notes are indicated, not displayed in the roster. The Classes back link preserves
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
opening and returning from inspection, pagination, Today only, empty
results, archive/read-only states, inactive swimmers, dialog cancel/focus return
and save failure recovery. Check the directory at 375, 768, 1024 and 1280 in light
and dark mode, including touch targets, overflow, landmarks and keyboard focus.
These checks do not modify shared database records.

The shadcn redesign passed `npm run typecheck`, `npm run lint`, all 145 tests
and `npx next build`. Synthetic browser checks covered combined site/search/
availability filters, return links, pagination, archived and empty results,
required fields, simulated save failure/retry, and all four widths in both
modes. Live checks confirmed the directory contains no legacy UI elements, class
links resolve and filtered return links survive.
