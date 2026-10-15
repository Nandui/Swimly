# Short courses

**Purpose:** runs the fixed-length courses the public book a place on.

The rules for courses, booking, the waiting list and registers are in [docs/short-courses.md](../../../docs/short-courses.md).

## Features
- `courses` — put a course on with its weekly sessions, book people on with their payment, keep the waiting list and take registers (`/short-courses`, `/short-courses/[id]`); its sessions as Rota commitments, area renames and the home card.
- `booking` — its courses on the public booking site (`apps/academy`): a public course source that lists courses open online, holds places or waiting-list places, and reports a customer's bookings.
- `course-types` — the course list: what we offer, where, and the weeks and session length a new run starts with (`/short-courses/types`).
- `workspace` — the frame, its one page list (`pages.ts`, for the page bar and the starter page `/short-courses/overview`) and the access check (`src/app/short-courses/layout.tsx`).

`shared/` holds what two or more features use: the pure rules (`rules.ts`, tested in `rules.test.ts`), the access check (`access.ts`), access at a course's site and page refreshes for writes (`server.ts`), site scoping for reads (`reads.ts`) and the dialogs' common fields (`components/form-kit.tsx`).

## Public API (index.ts)
- The status maps (`SHORT_COURSE_META`, `SHORT_COURSE_AREA_META`, `SHORT_COURSE_PAYMENT_META`, `SHORT_COURSE_PLACE_META`, `SHORT_COURSE_ONLINE_META`, `SHORT_COURSE_CALL_DUE_META`, `HEALTH_FORM_META`), for Core's tone check. The Rota sees sessions through commitments, registered in `module.ts`.

## Data owned
Declared in `prisma/schema/short-courses.prisma`:
- `short_courses_types` (`ShortCourseType`) — the course list.
- `short_courses_courses`, `short_courses_sessions` (`ShortCourse`, `ShortCourseSession`) — a course and its sessions.
- `short_courses_participants`, `short_courses_attendance` (`ShortCourseParticipant`, `ShortCourseAttendance`) — who is booked or waiting, and their register marks.

No relations to Core tables: sites, staff and areas are read through Core's functions.

## Events
- Emits: none.
- Listens to: none.

## Registration (module.ts)
- Commitments `short-courses.sessions`: each session for its instructor, so the Rota shows and counts it.
- Area renames `short-courses.places`: sessions follow a renamed area.
- Public course source (`registerPublicCourses`, ADR 0011): its courses open online on the booking site.
- Starter page items (`registerHomeCard`): places booked online to phone about, registers to take today, courses with a place free for the waiting list, courses starting in the next two weeks.
- Menu entry, levels and permissions: `manifest.ts`, listed in `src/app/modules.ts`.

## Permissions
- `short-courses.read`, `short-courses.run`, `short-courses.manage`.

## Depends on
- Platform: the policy engine, audit, areas (`src/lib/setup`), the database client, commitments, area renames, home cards and public course sources (`src/modules/contributions`, `src/lib/public-booking.ts`).
- Core reads (never Core tables; enforced by the boundary lint): sites and staff through `src/lib/directory.ts` (`liveSiteById`, `liveSitesOf`, `withSites`, `withStaff`, `staffContact`, `activeStaffAtSite`).
- The UI kit's workspace frame `ModuleShell` and `AreaSelect` (`src/components/ui`).
- Other modules: none.
