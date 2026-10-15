# 0011: The Academy joins Short courses, and one public booking site sells both

**Status:** Accepted (15 October 2026). Fernando asked for a customer portal at academy.leisureworldcork.com "like the parents app", where customers buy the courses, then said "lets merge academy and shortcourses into a single shortcourses module". He chose "Higher of the two" for each role's access.

## Context
The Academy (lifeguard and swim teacher qualifications) and Short courses (six and eight week courses) were two modules doing the same job for the public: courses with sessions, places, payment taken by the desk, registers and Rota commitments. Modules never import each other, so one booking site for both would have needed a Core seam between them.

## Decision
- One module, `short-courses` ("Short courses"). The Academy's code is its features `academy-courses`, `academy-types` and `academy-calls`, with `shared/academy-*.ts`; the booking site's API is its `booking` feature. Its pages are under `/short-courses/academy`; `/academy/...` redirects there (`next.config.ts`).
- Tables are unchanged (ADR 0002): the Academy's models stay as they are, declared in `prisma/schema/short-courses.academy.prisma`. A schema file named `<owner>.<part>.prisma` belongs to `<owner>` for the data lint. No migration.
- Permissions are unchanged. Each Short courses level gives both kinds of course their own permissions (`short-courses.*` and `academy.*`), so each keeps its rules: View books people on short courses but only sees Academy candidates, as before.
- A role's stored Academy level still counts, through the manifest's `formerly: ["academy"]`: `cleanLevels` reads it as a Short courses level and keeps the higher of the two, until the role is next saved. Nobody loses access; someone with only one of them gains the other at the same level.
- Audit rows for Academy records now name "Short courses"; older rows keep "Academy".
- The public site's API (`/api/academy/v1`) lists both kinds of course through two sources in the booking feature (`academy.ts`, `courses.ts`) sharing one shape (`shared/public-booking.ts`). Signing in lasts a week; a customer sees every booking under their checked email. Payment stays by phone (owner decision, 8 and 15 October 2026).

## Consequences
- The module list, role editor and menus show one module. Core changed only generically: `formerly` on a manifest, the schema file naming rule.
- `/api/academy/v1`, its settings and the site's Vercel project keep their names.
- Each kind of course keeps its tables, references (`AC-`, `SC-`) and staff screens for phoning people.
