# Academy

**Purpose:** runs the lifeguard and swim teacher courses the centre delivers.

The rules for courses, candidates, booking and payment calls are in [docs/academy.md](../../../docs/academy.md).

## Features
- `courses` — put a course on, its sessions, candidates, pre-course checks, registers and results (`/academy`, `/academy/[id]`); its sessions as Rota commitments and the home card.
- `course-types` — the course list: what the Academy offers and the qualification each grants (`/academy/types`).
- `calls` — phoning people who held a place online, to take payment (`/academy/calls`, and from a course).
- `booking` — the API behind the public booking site `apps/academy` (`/api/academy/v1`): courses on offer, email codes, held places.
- `workspace` — the Academy frame, its menu and the access check (`src/app/academy/layout.tsx`).

`shared/` holds what two or more features use: the pure rules (`rules.ts`, tested in `rules.test.ts`), the access check (`access.ts`), access at a course's site and page refreshes for writes (`server.ts`), site scoping for reads (`reads.ts`) and the dialogs' common fields (`components/form-kit.tsx`).

## Public API (index.ts)
- None. The Rota sees course sessions through commitments, registered in `module.ts`.

## Data owned
Declared in `prisma/schema/academy.prisma` (table names kept, ADR 0002):
- `AcademyCourseType` — the course list.
- `AcademyCourse`, `AcademySession` — a course and its sessions.
- `AcademyCandidate`, `AcademyAttendance` — who is on a course and their register marks.
- `AcademyCall` — payment calls logged against a candidate.
- `AcademyEmailCheck` — email codes for online booking.

The Academy also reads Core's `User`, `Club` and `QualificationType` directly (staff at a site, open sites, what a course grants). Moving those reads onto Core functions is phase 3 of [MIGRATION.md](../../../docs/architecture/MIGRATION.md).

## Events
- Emits: none.
- Listens to: none.

## Registration (module.ts)
- Commitments `academy.sessions`: each session for its tutor and assessor, so the Rota shows and counts it.
- Home card: people to call for payment, registers to take today, courses starting in the next two weeks.
- Menu entry, levels and permissions: still in `src/modules/registry.ts` (ADR 0004).

## Permissions
- `academy.read`, `academy.run`, `academy.manage`.

## Depends on
- Platform: the policy engine, audit, email (`src/lib/email`), the public API kit (`src/lib/public-api`), areas (`src/lib/setup`), the database client, commitments and home cards (`src/modules/contributions`).
- Core reads (never Core tables; enforced by the boundary lint): sites and staff through `src/lib/directory.ts` (`liveSiteById`, `liveSitesOf`, `withSites`, `withStaff`, `staffContact`, `activeStaffAtSite`); qualification types and the qualifications a pass records through `src/lib/qualifications.ts`.
- The shared workspace frame `ModuleShell` and Core's `AreaSelect`.
- Other modules: none.
