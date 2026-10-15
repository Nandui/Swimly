# 0011: One public booking site, fed by every module that sells courses

**Status:** Accepted (15 October 2026). Fernando asked for a customer portal at academy.leisureworldcork.com "like the parents app", where customers buy the courses.

## Context
The Academy already had a public booking site (`apps/academy`) and its API (`/api/academy/v1`), but only for Academy courses. Short courses planned the same online booking for phase 2. Modules never import each other, so the Academy's API could not read Short courses' tables or call its code.

## Decision
- One site and one API for customers. The API (Academy's `booking` feature) keeps the email check, tokens, rate limits and emails, and lists, books and reports through a seam in `src/modules/contributions.ts`: `registerPublicCourses` / `publicCourseSources`.
- The seam's shape lives in Core, `src/lib/public-booking.ts`: a public course, what holding a place takes and returns, a customer's booking, the hold deadline, booking references and the call-due wording. It names no module.
- The Academy and Short courses each register a source from their `module.ts` and hold places in their own tables, as before. A future module that sells to the public registers its own source; the site and API do not change.
- Signing in lasts a week (as the parent app's), kept in the browser and ended by signing out. A customer sees every booking under their checked email, including those the desk entered with it.
- Payment stays by phone (owner decision, 8 October 2026). Card payment is a later decision.

## Consequences
- `/api/academy/v1` keeps its name and settings; the site's Vercel project and domain are unchanged.
- Each module still owns its tables, references (`AC-`, `SC-`), audit rows and staff screens for phoning people.
- Tests of the API supply both sources through a double of the seam (`booking.test.ts`).
