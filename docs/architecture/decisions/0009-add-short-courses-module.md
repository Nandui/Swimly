# 0009: Add the Short courses module

**Status:** Accepted (13 October 2026, Fernando chose "Go" on the plan; final when he merges the PR).

## Context
Fernando asked (13 October 2026) for "another feature for short classes, like 6 weeks, 8 weeks", similar to the Academy, for the pool, the gym or anything else. The Academy runs qualification courses (pre-course checks, results, certificates, a qualification on a staff record) and the swim school runs weekly classes with no end date, so neither fits as it is. The plan (comparison, flows, levels, data and phases) is in the Artifact "Turnfin Short Courses Plan" and [docs/short-courses.md](../../short-courses.md). A new module changes the module map, which CLAUDE.md asks the owner to approve.

## Decision
- A new module `short-courses` in the Front of house group, beside the Academy: `src/modules/short-courses` with features `courses`, `course-types` and `workspace`, routes in `src/app/short-courses`, starter page `/short-courses/overview`. It copies the Academy's shape rather than extending it, because access is given per module (gym instructors should not see lifeguard candidates' checks) and the Academy stays about qualifications.
- Levels View, Instructor and Manage at the sites a person works at (`short-courses.read`, `.run`, `.manage`). View books people on and takes payment.
- Tables in the main database, prefixed `short_courses_` (CLAUDE.md section 5), models prefixed `ShortCourse` (ADR 0002), with no relations to Core tables.
- Sessions reach the Rota through the commitments seam. `Commitment` gains an optional `module` name, so the Rota says which module a session is planned in instead of always "the Academy".
- Built in three phases; this one runs courses from the desk. Online booking (phase 2) reuses the Academy's booking site; its email-code and hold-a-place code moves into shared code then (rule of two).

## Consequences
Adding the module needed no change to `src/platform`. Core gained the usual catalogue entries (three permissions, one screen, the audit module name), and the Rota now reads the module name from a commitment. No other module is called, and Short courses works with every other module switched off.
