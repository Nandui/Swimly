# Shared swimmers and curriculum

LeisureWorld's sites share swimmers, contacts, the curriculum and earned progress.
A site owns its classes and dated assessment sessions.

The working site filters the timetable and assessment sessions; it never restricts
swimmer search or profiles. Switching sites keeps the current page and swimmer.
Class enrolment, waitlisting, transfers and move-up actions can use either site's
classes: the pickers offer a site filter, list every site and name the destination.
A transfer locks both classes and the swimmer, rechecks capacity, ends the old
enrolment and opens a new one, and writes activity at both sites. Attendance stays
with the class and date where it happened. New classes and assessment sessions
belong to the working site, wherever their shared curriculum was first created.

## How the shared catalogue was made

The migration `20260911000000_shared_swimmers_curriculum` (applied in production)
made one catalogue from each site's copies.

The migration adds nullable self-links and indexes. It links duplicate programme
names, then matching levels, competencies and assessment types within their
shared parent. Comparison ignores case and leading/trailing spaces; it never
uses fuzzy matching. The first live definition by creation time/ID is canonical.
Different names remain separate definitions in the shared catalogue.

Every link has a shared audit entry. Original IDs, names, images, registration
sites, enrolments, classes, marks, assessors, assessment dates and completion
snapshots remain in place. No customer records are merged.

Runtime reads follow explicit IDs, not names. Renames cannot detach earlier
progress. New writes use shared IDs. Where both original copies hold a mark,
the most recently updated judgement wins (including a correction to Working
on). Completion snapshots continue to count across copies. Clearing a mark
clears all equivalents; revoking a completion removes and audits every equivalent
completion for that swimmer. Both actions retain their existing permissions.

## Tests

`npm test` includes an ephemeral PostgreSQL migration test with synthetic data: it
applies the earlier migrations, creates two sites' matching curriculum and history,
runs this migration and checks the history is preserved. Focused server tests cover
shared progress, duplicate completion prevention, site-independent swimmer access,
transfer audits at both sites, capacity rechecks and rollback when an audit write fails.
