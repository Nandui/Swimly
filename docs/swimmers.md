# Swimmers directory

The directory at `/students` is the entry point for finding every swimmer in
the system and opening their profile. It uses the owner-approved shadcn Neutral
components and shares the existing workspace and colour-mode preference.

- Search words can match first and last name, member number, contact name,
  email or phone. All statuses and all sites are included by default.
- All, Active and Inactive filters are URL links with whole-directory counts.
  The result count describes the current search. Search/filter changes reset
  pagination, and clear actions recover from empty results.
- Each row is one keyboard-accessible profile link. Member number and age help
  distinguish names; wide screens also show the main contact. Phones stack
  identifying details and levels without horizontal scrolling.
- Results are ordered by surname, first name and ID, 100 per page. Invalid and
  stale page numbers are bounded before constructing a database offset.
- Profile links preserve search, status and page through `returnTo`. Profile
  tabs carry this context; the back link accepts only directory parameters.
- The directory loads only the existing list projection and current placements.
  Medical notes and emergency details are not added to the directory payload.
- Add swimmer uses a shadcn dialog, calls the existing `createStudent` action
  and opens the new profile after success. Failure keeps all entered values.
  No schema, permissions, audit rules or record-management semantics changed.

Implementation lives in `components/students/swimmer-browser.tsx`,
`student-directory.tsx`, `add-swimmer.tsx`, `lib/students/directory.ts` and
`lib/students/data/students.ts` under `src/`. The full profile follows the journey layout described below.

Verification uses synthetic records in the ignored
`.impeccable/review/swimmers-shadcn` fixture, with all server writes replaced by
local simulated responses. Automated tests cover full-name/contact search,
inactive inclusion, authorization, bounded paging and safe profile return links.
Visual review covers 375, 768, 1024 and 1280 in both modes, long and missing
values, touch sizing, form scrolling, errors and retained optional fields.
Live-page verification reads structure only; no real swimmer data is exported.


## Full swimmer profile — journey layout (12 September 2026)

The owner selected option 3, “Journey through the school”. The profile at
`/students/[id]` now uses actual shadcn Avatar, Progress, Tabs, Collapsible,
Dialog, Command/Popover, Select and form controls with independent Neutral
tokens. It remains a desk page; the isolated Instructor workspace has no links
or access paths into it.

- Journey opens with enrolment chapters: active places first, then older ones.
  A programme filter supports simultaneous enrolments. Each chapter preserves
  its site, dates and class context, with compact activity and an expanded log.
- All activity unifies swimmer, enrolment and assessment audit records with
  legacy attendance, competency, completion and booking snapshots. Search,
  activity type and programme filters use a stable timestamp/ID cursor; there
  is no 30-record history ceiling. Each competency has a separate history dialog.
- History joins by swimmer/entity IDs, never a name in a class audit summary.
  Current shared competency and completion copies are deduplicated by explicit
  curriculum links. Historical programmes remain visible after enrolments end.
- Attendance and competency changes now preserve structured before/after values
  in nullable `AuditLog.details`. Teaching date, course, actor and notes remain
  attributable. Every changed swimmer receives an attendance audit entry in
  the same locked transaction as the register and existing class audit.
- Earlier summaries and current saved records remain visible, labelled where
  detailed historical changes were not captured. No earlier marks are invented.
  Detailed audit entries still require `activity.view`; the server checks both
  that permission and access to swimmer profiles on every history request.
- Competencies, Attendance, Assessments and Details are separate profile tabs.
  Marks retain unsaved edits when changing tabs or collapsing a level. All
  save, completion, correction, enrolment, move and end-date actions retain
  their existing server permission, validation, seat-lock and audit checks.
- The side rail shows every active enrolment, next scheduled weekly lesson,
  contact and medical details. Medical notes also appear prominently above
  profile tabs. Emergency phone remains visible without an emergency name.
  The next lesson is calculated from the weekly timetable and enrolment dates.

Schema migration `20260912103000_swimmer_history_details` is additive and was
applied with Prisma migrate deploy. It adds only nullable JSON evidence;
older deployments and existing summaries remain compatible.

Focused checks cover exact competency/attendance evidence, rollback if any
swimmer audit fails, no-op saves, shared aliases, permissions, SQL filters,
stable paging, historical progress and next-lesson dates. PostgreSQL query
checks use an isolated PGlite instance. Browser checks use only synthetic
records in `.impeccable/review/swimmer-profile`; writes are simulated there.
