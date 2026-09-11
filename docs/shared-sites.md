# Shared swimmers and curriculum

The working site filters the timetable and assessment sessions. Swimmer search,
profiles, contacts and progress are shared. Class enrolment, waitlisting,
transfers and move-up actions can use either site's classes. New classes and
assessment sessions belong to the selected working site, regardless of where
their shared curriculum was originally created.

## Upgrade

Apply `20260911000000_shared_swimmers_curriculum` before starting this version
against an existing database. Production's existing build migration step does
this; preview builds do not. Development and production share the database, so
coordinate application of the additive migration with release of this branch.

The migration adds nullable self-links and indexes. It links duplicate programme
names, then matching levels, competencies and assessment types within their
shared parent. Comparison ignores case and leading/trailing spaces; it never
uses fuzzy matching. The first live definition by creation time/ID is canonical.
Different names remain separate definitions in the shared catalogue.

Every link has a shared audit entry. Original IDs, names, images, registration
sites, enrolments, classes, marks, assessors, assessment dates and completion
snapshots remain in place. No customer records are merged. The columns and
original rows also remain readable by the previous application version.

Runtime reads follow explicit IDs, not names. Renames cannot detach earlier
progress. New writes use shared IDs. Where both original copies hold a mark,
the most recently updated judgement wins (including a correction to Working
on). Completion snapshots continue to count across copies. Clearing a mark
clears all equivalents; revoking a completion removes and audits every equivalent
completion for that swimmer. Both actions retain their existing permissions.

## Verification

`npm test` includes an ephemeral PostgreSQL migration test with synthetic data.
It applies the previous migrations, creates two sites' matching curriculum and
history, runs the new migration and compares historical rows for preservation.
It never reads credentials or connects to the live database.

Focused server tests cover shared progress, duplicate completion prevention,
site-independent swimmer access, source/destination transfer audits, capacity
rechecks and rollback when audit writes fail. `npm run typecheck` and
`npm run lint` remain required.

After release, inspect the shared catalogue and existing records through the
normal authenticated app. Confirm both sites' class lists, the global swimmer
search and the site selector in swimmer enrolment and move dialogs. Use synthetic records
only in isolated tests; do not create live bookings as a verification shortcut.
