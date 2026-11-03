# Academy

**Purpose:** runs the lifeguard and swim teacher courses the centres deliver to the public.

The Academy joined Short courses on 15 October 2026 and became its own app again, in Team, on 3 November 2026 ([D24](../../../docs/decisions.md)). Its levels are in [docs/apps.md](../../../docs/apps.md#academy).

## Features
- `courses`: the courses at a person's sites, putting one on, its sessions, candidates, checks, payment, registers and results (`/academy`, `/academy/[id]`); its sessions for the Rota, Home's items and a member's Academy history.
- `calls`: people who held a place online, to phone and take payment (`/academy/calls`), and the call backs for the swim school's reception analytics.
- `types`: the Academy course list, kept with Manage (`/academy/types`).
- `booking`: the Academy booking site's API (`/api/academy/v1`, used by `apps/academy`): courses open online, email codes, held places and a customer's own bookings.
- `workspace`: the frame and its one page list (`pages.ts`, for the page bar and the starter page `/academy/overview`). Old `/short-courses/academy/…` links redirect to `/academy/…`.

`shared/` holds what two or more features use: the rules and status metadata (`rules.ts`), the access check (`access.ts`), the writes' site check (`server.ts`), the public booking shapes (`public-booking.ts`), and booking people from the swimmer records (`swimmers.ts`, `swimmer-search.ts`, `components/`). Those last three are the Academy's own copy of what Short courses also has: neither app imports the other.

## Front door (index.ts)
- `ACADEMY_*_META`: each status's label, tone and icon. Used by Core's status-metadata test.

## Data owned
Declared in `prisma/schema/academy.prisma` (table names kept):
- `AcademyCourseType`: one course the Academy delivers, and what it asks of a candidate.
- `AcademyCourse`: a course put on at a site: tutor, assessor, places and price.
- `AcademySession`: one session of a course, and its register.
- `AcademyCandidate`: one person on a course: checks, payment and result.
- `AcademyCall`: each call to someone who held a place online.
- `AcademyEmailCheck`: the booking site's email codes and tokens.
- `AcademyAttendance`: who was at each session.

## Events
- Emits: none.
- Listens to: none.

## Registration (module.ts)
- Commitments (`academy.sessions`): each session for its tutor and assessor, so the Rota shows them.
- Home card: people to call for payment, registers to take today, courses starting soon.
- Desk measures (`academy.calls`): call backs within 72 hours.
- Member history (`academy.candidates`): the Academy courses on a swimmer's profile.
- Menu entry, levels and permissions: `manifest.ts`, listed in `src/app/modules.ts`. A role's stored Short courses Instructor or Manage level counts here as Tutor or Manage, and until a superadmin sets this app's switch it follows Short courses' (`formerly`).

## Permissions
- `academy.read`, `academy.run`, `academy.manage`

## Depends on
- Platform: auth, the policy engine (`src/lib/policy`), audit, email, the public-API kit (`src/lib/public-api`), the database client, the member directory, home cards, commitments, desk measures, member history and the email bookings plug (`src/modules/contributions`).
- Core reads through `src/lib/directory.ts` and `src/lib/qualifications.ts`, never Core tables.
- Other apps: none. A customer's short course places come into "My bookings" through the email bookings plug.
