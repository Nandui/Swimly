# Short courses

**Purpose:** runs the courses the public book a place on.

Two kinds of course: six and eight week courses, and the Academy's lifeguard and swim teacher qualifications, which joined this module on 15 October 2026 ([ADR 0011](../../../docs/architecture/decisions/0011-merge-academy-into-short-courses.md)). The rules are in [docs/short-courses.md](../../../docs/short-courses.md) and [docs/academy.md](../../../docs/academy.md).

## Features
- `courses` — put a course on with its weekly sessions, book people on with their payment, keep the waiting list and take registers (`/short-courses`, `/short-courses/[id]`); its sessions as Rota commitments, area renames and the home card.
- `academy-courses` — put an Academy course on, its sessions, candidates, pre-course checks, registers and results (`/short-courses/academy`, `/short-courses/academy/[id]`); its sessions as Rota commitments and home card items.
- `academy-types` — the Academy course list: what we deliver and the qualification each grants (`/short-courses/academy/types`).
- `academy-calls` — phoning people who held an Academy place online, to take payment (`/short-courses/academy/calls`, and from a course).
- `booking` — the API behind the public booking site `apps/academy` (`/api/academy/v1`): email codes and sign-in, both kinds of course open online (`academy.ts`, `courses.ts`), held places or waiting-list places, and a customer's bookings.
- `course-types` — the course list: what we offer, where, and the weeks and session length a new run starts with (`/short-courses/types`).
- `workspace` — the frame, its one page list (`pages.ts`, for the page bar and the starter page `/short-courses/overview`) and the access check (`src/app/short-courses/layout.tsx`).

`shared/` holds what two or more features use: the pure rules (`rules.ts`, `academy-rules.ts`, each tested beside it), the access checks (`access.ts`, `academy-access.ts`), access at a course's site and page refreshes for writes (`server.ts`, `academy-server.ts`), site scoping for reads (`reads.ts`), the dialogs' common fields (`components/form-kit.tsx`), the booking site's shape (`public-booking.ts`), and booking from the swimmer records (`swimmers.ts`, the search action `swimmer-search.ts`, `components/swimmer-picker.tsx` and `components/swimmer-card.tsx`; ADR 0014).

## Public API (index.ts)
- The status maps (`SHORT_COURSE_META`, `SHORT_COURSE_AREA_META`, `SHORT_COURSE_PAYMENT_META`, `SHORT_COURSE_PLACE_META`, `SHORT_COURSE_ONLINE_META`, `SHORT_COURSE_CALL_DUE_META`, `HEALTH_FORM_META`, `SWIMMER_RECORD_META`), for Core's tone check. The Rota sees sessions through commitments, registered in `module.ts`.

## Data owned
Declared in `prisma/schema/short-courses.prisma` and, for Academy courses (table names kept, ADR 0002), `prisma/schema/short-courses.academy.prisma`:
- `short_courses_types` (`ShortCourseType`) — the course list.
- `short_courses_courses`, `short_courses_sessions` (`ShortCourse`, `ShortCourseSession`) — a course and its sessions.
- `short_courses_participants`, `short_courses_attendance` (`ShortCourseParticipant`, `ShortCourseAttendance`) — who is booked or waiting (with their swimmer record's id, `swimmerId`), and their register marks.

- `AcademyCourseType`, `AcademyCourse`, `AcademySession` — the Academy course list, a course and its sessions.
- `AcademyCandidate`, `AcademyAttendance`, `AcademyCall` — candidates (a member of the public with their `swimmerId`), their register marks and payment calls.
- `AcademyEmailCheck` — email codes and sign-in tokens for the booking site.

Sites, staff and areas are read through Core's functions; Academy tables keep their relations to Core's qualification types (enforced by the boundary lint).

## Events
- Emits: none.
- Listens to: none.

## Registration (module.ts)
- Commitments `short-courses.sessions` and `academy.sessions`: each session for its instructor, or tutor and assessor, so the Rota shows and counts it.
- Area renames `short-courses.places`: sessions follow a renamed area.
- Starter page items (`registerHomeCard`): places booked online to phone about, registers to take today, courses with a place free for the waiting list, courses starting in the next two weeks, for both kinds of course.
- Member history `short-courses.bookings` and `short-courses.academy-candidates`: the courses a swimmer has been on, for their profile.
- Menu entry, levels and permissions: `manifest.ts`, listed in `src/app/modules.ts`. A role's old Academy level still counts here (`formerly`).

## Permissions
- `short-courses.read`, `short-courses.run`, `short-courses.manage`, and for Academy courses `academy.read`, `academy.run`, `academy.manage`; each level gives both of its rank.

## Depends on
- Platform: the policy engine, audit, email (`src/lib/email`), the public API kit (`src/lib/public-api`), areas (`src/lib/setup`), the database client, commitments, area renames, home cards, the member directory and member history (`src/modules/contributions`).
- Core reads (never Core tables; enforced by the boundary lint): sites and staff through `src/lib/directory.ts` (`liveSiteById`, `liveSitesOf`, `withSites`, `withStaff`, `staffContact`, `activeStaffAtSite`); qualification types and the qualifications an Academy pass records through `src/lib/qualifications.ts`.
- The UI kit's workspace frame `ModuleShell` and `AreaSelect` (`src/components/ui`).
- Other modules: none imported. The swim school's swimmer records are read and added through the member directory seam (a direct call: the booking needs the answer), and work without it.
